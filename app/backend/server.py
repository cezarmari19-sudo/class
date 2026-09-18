from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hashlib
import secrets
import string
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# =========================================================================
# Helpers
# =========================================================================
ACCOUNT_CODE_LEN = 16
LOBBY_CODE_LEN = 8


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def gen_account_code() -> str:
    # 16 chars, uppercase letters + digits (Mullvad-like)
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(ACCOUNT_CODE_LEN))


def gen_lobby_code() -> str:
    # exactly 8 uppercase letters
    return "".join(secrets.choice(string.ascii_uppercase) for _ in range(LOBBY_CODE_LEN))


# =========================================================================
# Models
# =========================================================================
class CreateAccountResponse(BaseModel):
    account_code: str
    user_id: str


class LoginRequest(BaseModel):
    account_code: str


class UserOut(BaseModel):
    user_id: str
    created_at: str


class LobbySettings(BaseModel):
    allow_everyone_to_see_scores: bool = False


class LobbyCreate(BaseModel):
    name: Optional[str] = None


class LobbyOut(BaseModel):
    id: str
    code: str
    name: str
    admin_id: str
    created_at: str
    settings: LobbySettings
    is_admin: bool = False
    member_count: int = 0


class JoinLobbyRequest(BaseModel):
    code: str
    display_name: str


class MemberOut(BaseModel):
    id: str
    lobby_id: str
    user_id: str
    display_name: str
    score: int
    joined_at: str


class ScoreChangeRequest(BaseModel):
    change: int  # can be positive or negative


class EditNameRequest(BaseModel):
    display_name: str


class SettingsUpdateRequest(BaseModel):
    allow_everyone_to_see_scores: bool


class AddMemberRequest(BaseModel):
    display_name: str


class ScoreHistoryOut(BaseModel):
    id: str
    lobby_id: str
    member_id: str
    admin_id: str
    change: int
    previous_score: int
    new_score: int
    timestamp: str


# =========================================================================
# Auth dependency
# =========================================================================
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty token")
    code_hash = hash_code(token)
    user = await db.users.find_one({"code_hash": code_hash}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid account code")
    return user


# =========================================================================
# Auth Endpoints
# =========================================================================
@api_router.post("/auth/create", response_model=CreateAccountResponse)
async def create_account():
    # ensure uniqueness (extremely unlikely to collide, but be safe)
    for _ in range(5):
        code = gen_account_code()
        code_hash = hash_code(code)
        existing = await db.users.find_one({"code_hash": code_hash})
        if not existing:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique account code")

    user_id = str(uuid.uuid4())
    doc = {
        "user_id": user_id,
        "code_hash": code_hash,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return CreateAccountResponse(account_code=code, user_id=user_id)


@api_router.post("/auth/login", response_model=UserOut)
async def login(req: LoginRequest):
    code = (req.account_code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="account_code required")
    user = await db.users.find_one({"code_hash": hash_code(code)}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid account code")
    return UserOut(user_id=user["user_id"], created_at=user["created_at"])


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(user_id=user["user_id"], created_at=user["created_at"])


# =========================================================================
# Lobby Endpoints
# =========================================================================
async def _lobby_by_code(code: str) -> dict:
    lobby = await db.lobbies.find_one({"code": code.upper()}, {"_id": 0})
    if not lobby:
        raise HTTPException(status_code=404, detail="Lobby not found")
    return lobby


async def _lobby_by_id(lobby_id: str) -> dict:
    lobby = await db.lobbies.find_one({"id": lobby_id}, {"_id": 0})
    if not lobby:
        raise HTTPException(status_code=404, detail="Lobby not found")
    return lobby


async def _serialize_lobby(lobby: dict, user_id: str) -> LobbyOut:
    member_count = await db.members.count_documents({"lobby_id": lobby["id"]})
    return LobbyOut(
        id=lobby["id"],
        code=lobby["code"],
        name=lobby.get("name") or f"Lobby {lobby['code']}",
        admin_id=lobby["admin_id"],
        created_at=lobby["created_at"],
        settings=LobbySettings(**lobby.get("settings", {})),
        is_admin=(lobby["admin_id"] == user_id),
        member_count=member_count,
    )


@api_router.post("/lobbies", response_model=LobbyOut)
async def create_lobby(body: LobbyCreate, user: dict = Depends(get_current_user)):
    # generate unique 8-letter code
    for _ in range(10):
        code = gen_lobby_code()
        existing = await db.lobbies.find_one({"code": code})
        if not existing:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique lobby code")

    lobby_id = str(uuid.uuid4())
    doc = {
        "id": lobby_id,
        "code": code,
        "name": (body.name or "").strip()[:100] or f"Lobby {code}",
        "admin_id": user["user_id"],
        "created_at": now_iso(),
        "settings": {"allow_everyone_to_see_scores": False},
    }
    await db.lobbies.insert_one(doc)
    return await _serialize_lobby(doc, user["user_id"])


@api_router.get("/lobbies", response_model=List[LobbyOut])
async def list_my_lobbies(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    # lobbies user is admin of
    admin_lobbies = await db.lobbies.find({"admin_id": uid}, {"_id": 0}).to_list(1000)
    # lobbies user is a member of
    member_docs = await db.members.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    member_lobby_ids = [m["lobby_id"] for m in member_docs]
    member_lobbies = []
    if member_lobby_ids:
        member_lobbies = await db.lobbies.find({"id": {"$in": member_lobby_ids}}, {"_id": 0}).to_list(1000)

    seen = set()
    result: List[LobbyOut] = []
    for lobby in admin_lobbies + member_lobbies:
        if lobby["id"] in seen:
            continue
        seen.add(lobby["id"])
        result.append(await _serialize_lobby(lobby, uid))
    return result


@api_router.get("/lobbies/{code}", response_model=LobbyOut)
async def get_lobby(code: str, user: dict = Depends(get_current_user)):
    lobby = await _lobby_by_code(code)
    uid = user["user_id"]
    # must be admin or member
    if lobby["admin_id"] != uid:
        is_member = await db.members.find_one({"lobby_id": lobby["id"], "user_id": uid})
        if not is_member:
            raise HTTPException(status_code=403, detail="You are not part of this lobby")
    return await _serialize_lobby(lobby, uid)


@api_router.post("/lobbies/join", response_model=MemberOut)
async def join_lobby(body: JoinLobbyRequest, user: dict = Depends(get_current_user)):
    display_name = (body.display_name or "").strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="display_name required")
    if len(display_name) > 100:
        raise HTTPException(status_code=400, detail="display_name too long (max 100)")

    lobby = await _lobby_by_code(body.code)
    uid = user["user_id"]

    if lobby["admin_id"] == uid:
        raise HTTPException(status_code=400, detail="You are the admin of this lobby")

    existing = await db.members.find_one({"lobby_id": lobby["id"], "user_id": uid}, {"_id": 0})
    if existing:
        return MemberOut(**existing)

    member_id = str(uuid.uuid4())
    doc = {
        "id": member_id,
        "lobby_id": lobby["id"],
        "user_id": uid,
        "display_name": display_name,
        "score": 100,
        "joined_at": now_iso(),
    }
    await db.members.insert_one(doc)
    return MemberOut(id=member_id, lobby_id=lobby["id"], user_id=uid,
                     display_name=display_name, score=100, joined_at=doc["joined_at"])


@api_router.delete("/lobbies/{lobby_id}")
async def delete_lobby(lobby_id: str, user: dict = Depends(get_current_user)):
    lobby = await _lobby_by_id(lobby_id)
    if lobby["admin_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the admin can delete this lobby")
    await db.lobbies.delete_one({"id": lobby_id})
    await db.members.delete_many({"lobby_id": lobby_id})
    await db.score_history.delete_many({"lobby_id": lobby_id})
    return {"ok": True}


@api_router.patch("/lobbies/{lobby_id}/settings", response_model=LobbyOut)
async def update_settings(lobby_id: str, body: SettingsUpdateRequest, user: dict = Depends(get_current_user)):
    lobby = await _lobby_by_id(lobby_id)
    if lobby["admin_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the admin can change settings")
    settings = {"allow_everyone_to_see_scores": bool(body.allow_everyone_to_see_scores)}
    await db.lobbies.update_one({"id": lobby_id}, {"$set": {"settings": settings}})
    lobby["settings"] = settings
    return await _serialize_lobby(lobby, user["user_id"])


# =========================================================================
# Member Endpoints
# =========================================================================
@api_router.get("/lobbies/{lobby_id}/members", response_model=List[MemberOut])
async def list_members(lobby_id: str, user: dict = Depends(get_current_user)):
    lobby = await _lobby_by_id(lobby_id)
    uid = user["user_id"]
    is_admin = lobby["admin_id"] == uid
    if not is_admin:
        is_member = await db.members.find_one({"lobby_id": lobby_id, "user_id": uid})
        if not is_member:
            raise HTTPException(status_code=403, detail="Not part of this lobby")

    members = await db.members.find({"lobby_id": lobby_id}, {"_id": 0}).sort("joined_at", 1).to_list(10000)

    # If admin OR setting allows, return scores as-is. Otherwise mask others' scores.
    allow_all = lobby.get("settings", {}).get("allow_everyone_to_see_scores", False)
    out = []
    for m in members:
        if is_admin or allow_all or m["user_id"] == uid:
            out.append(MemberOut(**m))
        else:
            # hide score by returning -1 sentinel? Better: still return but keep score for own; keep others as 100 default.
            # We'll return score anyway - the spec asks admin controls to be gated in backend, but visibility can still be hidden client-side.
            # To be safe: only include score if allowed; otherwise 0 placeholder. We'll use -1 sentinel and frontend hides it.
            copy = dict(m)
            copy["score"] = -1
            out.append(MemberOut(**copy))
    return out


@api_router.get("/lobbies/{lobby_id}/members/{member_id}", response_model=MemberOut)
async def get_member(lobby_id: str, member_id: str, user: dict = Depends(get_current_user)):
    lobby = await _lobby_by_id(lobby_id)
    uid = user["user_id"]
    is_admin = lobby["admin_id"] == uid

    member = await db.members.find_one({"id": member_id, "lobby_id": lobby_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if not is_admin:
        is_self = member["user_id"] == uid
        is_lobby_member = await db.members.find_one({"lobby_id": lobby_id, "user_id": uid})
        if not is_lobby_member:
            raise HTTPException(status_code=403, detail="Not part of this lobby")
        allow_all = lobby.get("settings", {}).get("allow_everyone_to_see_scores", False)
        if not is_self and not allow_all:
            copy = dict(member)
            copy["score"] = -1
            return MemberOut(**copy)

    return MemberOut(**member)


@api_router.post("/lobbies/{lobby_id}/members", response_model=MemberOut)
async def add_member_manually(lobby_id: str, body: AddMemberRequest, user: dict = Depends(get_current_user)):
    lobby = await _lobby_by_id(lobby_id)
    if lobby["admin_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only admin can add members")

    display_name = (body.display_name or "").strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="display_name required")
    if len(display_name) > 100:
        raise HTTPException(status_code=400, detail="display_name too long (max 100)")

    member_id = str(uuid.uuid4())
    doc = {
        "id": member_id,
        "lobby_id": lobby_id,
        "user_id": f"placeholder:{member_id}",  # placeholder user for manually added
        "display_name": display_name,
        "score": 100,
        "joined_at": now_iso(),
    }
    await db.members.insert_one(doc)
    return MemberOut(**{k: v for k, v in doc.items() if k != "_id"})


@api_router.patch("/lobbies/{lobby_id}/members/{member_id}/name", response_model=MemberOut)
async def edit_member_name(lobby_id: str, member_id: str, body: EditNameRequest,
                            user: dict = Depends(get_current_user)):
    lobby = await _lobby_by_id(lobby_id)
    if lobby["admin_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only admin can edit names")

    display_name = (body.display_name or "").strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="display_name required")
    if len(display_name) > 100:
        raise HTTPException(status_code=400, detail="display_name too long (max 100)")

    result = await db.members.find_one_and_update(
        {"id": member_id, "lobby_id": lobby_id},
        {"$set": {"display_name": display_name}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Member not found")
    result.pop("_id", None)
    return MemberOut(**result)


@api_router.post("/lobbies/{lobby_id}/members/{member_id}/score", response_model=MemberOut)
async def change_score(lobby_id: str, member_id: str, body: ScoreChangeRequest,
                        user: dict = Depends(get_current_user)):
    lobby = await _lobby_by_id(lobby_id)
    if lobby["admin_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only admin can change scores")

    member = await db.members.find_one({"id": member_id, "lobby_id": lobby_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    previous = int(member["score"])
    new_score = max(0, min(100, previous + int(body.change)))
    actual_change = new_score - previous

    await db.members.update_one({"id": member_id, "lobby_id": lobby_id}, {"$set": {"score": new_score}})

    history_doc = {
        "id": str(uuid.uuid4()),
        "lobby_id": lobby_id,
        "member_id": member_id,
        "admin_id": user["user_id"],
        "change": actual_change,
        "previous_score": previous,
        "new_score": new_score,
        "timestamp": now_iso(),
    }
    await db.score_history.insert_one(history_doc)

    member["score"] = new_score
    return MemberOut(**member)


@api_router.delete("/lobbies/{lobby_id}/members/{member_id}")
async def remove_member(lobby_id: str, member_id: str, user: dict = Depends(get_current_user)):
    lobby = await _lobby_by_id(lobby_id)
    if lobby["admin_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only admin can remove members")

    result = await db.members.delete_one({"id": member_id, "lobby_id": lobby_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.score_history.delete_many({"lobby_id": lobby_id, "member_id": member_id})
    return {"ok": True}


@api_router.get("/lobbies/{lobby_id}/members/{member_id}/history", response_model=List[ScoreHistoryOut])
async def get_history(lobby_id: str, member_id: str, user: dict = Depends(get_current_user)):
    lobby = await _lobby_by_id(lobby_id)
    uid = user["user_id"]
    is_admin = lobby["admin_id"] == uid

    if not is_admin:
        # only allowed if allow_everyone_to_see_scores OR viewing own
        member = await db.members.find_one({"id": member_id, "lobby_id": lobby_id}, {"_id": 0})
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        allow_all = lobby.get("settings", {}).get("allow_everyone_to_see_scores", False)
        is_self = member["user_id"] == uid
        if not (allow_all or is_self):
            raise HTTPException(status_code=403, detail="Not allowed to view history")

    history = await db.score_history.find(
        {"lobby_id": lobby_id, "member_id": member_id}, {"_id": 0}
    ).sort("timestamp", -1).to_list(1000)
    return [ScoreHistoryOut(**h) for h in history]


# =========================================================================
# Root
# =========================================================================
@api_router.get("/")
async def root():
    return {"message": "ClassLobby API", "ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
