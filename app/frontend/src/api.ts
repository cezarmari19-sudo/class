// API client with auth token handling
import { storage } from "@/src/utils/storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export const AUTH_KEY = "account_code";

export async function getAccountCode(): Promise<string | null> {
  return await storage.secureGet<string | null>(AUTH_KEY, null);
}

export async function setAccountCode(code: string): Promise<void> {
  await storage.secureSet(AUTH_KEY, code);
}

export async function clearAccountCode(): Promise<void> {
  await storage.secureRemove(AUTH_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const code = await getAccountCode();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (code) {
    headers["Authorization"] = `Bearer ${code}`;
  }
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ================= Types =================
export type LobbySettings = { allow_everyone_to_see_scores: boolean };
export type Lobby = {
  id: string;
  code: string;
  name: string;
  admin_id: string;
  created_at: string;
  settings: LobbySettings;
  is_admin: boolean;
  member_count: number;
};
export type Member = {
  id: string;
  lobby_id: string;
  user_id: string;
  display_name: string;
  score: number; // -1 means hidden
  joined_at: string;
};
export type ScoreHistoryItem = {
  id: string;
  lobby_id: string;
  member_id: string;
  admin_id: string;
  change: number;
  previous_score: number;
  new_score: number;
  timestamp: string;
};
export type MeResponse = { user_id: string; created_at: string };

// ================= Endpoints =================
export const api = {
  createAccount: () =>
    request<{ account_code: string; user_id: string }>("/auth/create", { method: "POST" }),
  login: (account_code: string) =>
    request<MeResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ account_code }),
    }),
  me: () => request<MeResponse>("/auth/me"),

  listLobbies: () => request<Lobby[]>("/lobbies"),
  createLobby: (name?: string) =>
    request<Lobby>("/lobbies", { method: "POST", body: JSON.stringify({ name: name || null }) }),
  getLobby: (code: string) => request<Lobby>(`/lobbies/${code.toUpperCase()}`),
  joinLobby: (code: string, display_name: string) =>
    request<Member>(`/lobbies/join`, {
      method: "POST",
      body: JSON.stringify({ code: code.toUpperCase(), display_name }),
    }),
  deleteLobby: (lobby_id: string) =>
    request<{ ok: boolean }>(`/lobbies/${lobby_id}`, { method: "DELETE" }),
  updateSettings: (lobby_id: string, allow_everyone_to_see_scores: boolean) =>
    request<Lobby>(`/lobbies/${lobby_id}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ allow_everyone_to_see_scores }),
    }),

  listMembers: (lobby_id: string) => request<Member[]>(`/lobbies/${lobby_id}/members`),
  getMember: (lobby_id: string, member_id: string) =>
    request<Member>(`/lobbies/${lobby_id}/members/${member_id}`),
  addMember: (lobby_id: string, display_name: string) =>
    request<Member>(`/lobbies/${lobby_id}/members`, {
      method: "POST",
      body: JSON.stringify({ display_name }),
    }),
  editName: (lobby_id: string, member_id: string, display_name: string) =>
    request<Member>(`/lobbies/${lobby_id}/members/${member_id}/name`, {
      method: "PATCH",
      body: JSON.stringify({ display_name }),
    }),
  changeScore: (lobby_id: string, member_id: string, change: number) =>
    request<Member>(`/lobbies/${lobby_id}/members/${member_id}/score`, {
      method: "POST",
      body: JSON.stringify({ change }),
    }),
  removeMember: (lobby_id: string, member_id: string) =>
    request<{ ok: boolean }>(`/lobbies/${lobby_id}/members/${member_id}`, { method: "DELETE" }),
  getHistory: (lobby_id: string, member_id: string) =>
    request<ScoreHistoryItem[]>(`/lobbies/${lobby_id}/members/${member_id}/history`),
};
