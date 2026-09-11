import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { api, clearAccountCode, getAccountCode, Lobby } from "@/src/api";
import { toast } from "@/src/components/toast";
import { makeStyles, useTheme } from "@/src/theme";

export default function LobbiesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const [newLobbyName, setNewLobbyName] = useState("");
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [myCode, setMyCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.listLobbies();
      setLobbies(data);
    } catch (e: any) {
      toast(e?.message || "Failed to load lobbies", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      getAccountCode().then(setMyCode);
    }, [load]),
  );

  const onCreate = async () => {
    setCreating(true);
    try {
      const lobby = await api.createLobby(newLobbyName.trim() || undefined);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreateOpen(false);
      setNewLobbyName("");
      router.push(`/lobby/${lobby.code}?created=1`);
    } catch (e: any) {
      toast(e?.message || "Failed to create lobby", "error");
    } finally {
      setCreating(false);
    }
  };

  const onJoin = async () => {
    if (!joinCode.trim() || joinCode.trim().length !== 8) {
      toast("Enter the 8-letter code", "error");
      return;
    }
    if (!joinName.trim()) {
      toast("Enter your display name", "error");
      return;
    }
    if (joinName.trim().length > 100) {
      toast("Name too long (max 100)", "error");
      return;
    }
    setJoining(true);
    try {
      await api.joinLobby(joinCode.trim(), joinName.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoinOpen(false);
      const code = joinCode.trim().toUpperCase();
      setJoinCode("");
      setJoinName("");
      router.push(`/lobby/${code}`);
    } catch (e: any) {
      toast(e?.message || "Failed to join", "error");
    } finally {
      setJoining(false);
    }
  };

  const onSignOut = async () => {
    await clearAccountCode();
    setSignOutOpen(false);
    router.replace("/auth");
  };

  const copyMyCode = async () => {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    toast("Account code copied", "success");
    await Haptics.selectionAsync();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="lobbies-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hi}>Welcome back 👋</Text>
          <Text style={styles.title}>Your lobbies</Text>
        </View>
        <Pressable
          testID="signout-btn"
          onPress={() => setSignOutOpen(true)}
          style={styles.iconBtn}
        >
          <Text style={styles.iconBtnText}>⎋</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={lobbies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 200, paddingTop: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.brandPrimary}
            />
          }
          ListHeaderComponent={
            <Pressable
              testID="show-my-code-btn"
              onPress={copyMyCode}
              style={styles.myCodeCard}
            >
              <Text style={styles.myCodeLabel}>Your account code (tap to copy)</Text>
              <Text style={styles.myCodeValue} numberOfLines={1}>
                {myCode ? maskCode(myCode) : "—"}
              </Text>
            </Pressable>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🪑</Text>
              <Text style={styles.emptyTitle}>No lobbies yet</Text>
              <Text style={styles.emptySub}>Create one as a teacher, or join with a code from your teacher.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`lobby-card-${item.code}`}
              onPress={() => router.push(`/lobby/${item.code}`)}
              style={({ pressed }) => [styles.lobbyCard, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.lobbyLeft}>
                <View style={[styles.lobbyBadge, { backgroundColor: item.is_admin ? colors.brandPrimary : colors.brandTertiary }]}>
                  <Text style={[styles.lobbyBadgeText, { color: item.is_admin ? colors.onBrandPrimary : colors.onBrandTertiary }]}>
                    {item.is_admin ? "ADMIN" : "MEMBER"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lobbyName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.lobbyMeta}>
                    <Text style={styles.lobbyCode}>{item.code}</Text> · {item.member_count} member{item.member_count === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          )}
        />
      )}

      {/* Sticky bottom actions */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          testID="open-join-btn"
          onPress={() => setJoinOpen(true)}
          style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.joinBtnText}>Join lobby</Text>
        </Pressable>
        <Pressable
          testID="open-create-btn"
          onPress={() => setCreateOpen(true)}
          style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.createBtnText}>+ Create lobby</Text>
        </Pressable>
      </View>

      {/* Create Modal */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <Pressable style={styles.modalBg} onPress={() => setCreateOpen(false)}>
            <View />
          </Pressable>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Create a new lobby</Text>
            <Text style={styles.modalSub}>You'll be the admin. A unique 8-letter code will be generated to share.</Text>
            <TextInput
              testID="new-lobby-name-input"
              value={newLobbyName}
              onChangeText={setNewLobbyName}
              placeholder="Lobby name (optional)"
              placeholderTextColor={colors.muted}
              maxLength={100}
              style={styles.modalInput}
            />
            <Pressable
              testID="confirm-create-btn"
              onPress={onCreate}
              disabled={creating}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }, creating && { opacity: 0.6 }]}
            >
              {creating ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryBtnText}>Create lobby</Text>}
            </Pressable>
            <Pressable onPress={() => setCreateOpen(false)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Join Modal */}
      <Modal visible={joinOpen} transparent animationType="fade" onRequestClose={() => setJoinOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <Pressable style={styles.modalBg} onPress={() => setJoinOpen(false)}>
            <View />
          </Pressable>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Join a lobby</Text>
            <Text style={styles.modalSub}>Enter the 8-letter code and your display name.</Text>
            <TextInput
              testID="join-code-input"
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase().slice(0, 8))}
              placeholder="8-LETTER CODE"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              maxLength={8}
              style={[styles.modalInput, styles.codeInput]}
            />
            <TextInput
              testID="join-name-input"
              value={joinName}
              onChangeText={setJoinName}
              placeholder="Display name"
              placeholderTextColor={colors.muted}
              maxLength={100}
              style={styles.modalInput}
            />
            <Text style={styles.charCount}>{joinName.length}/100</Text>
            <Pressable
              testID="confirm-join-btn"
              onPress={onJoin}
              disabled={joining}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }, joining && { opacity: 0.6 }]}
            >
              {joining ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryBtnText}>Join</Text>}
            </Pressable>
            <Pressable onPress={() => setJoinOpen(false)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sign out confirm */}
      <Modal visible={signOutOpen} transparent animationType="fade" onRequestClose={() => setSignOutOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Sign out?</Text>
            <Text style={styles.modalSub}>
              You'll need your account code to log back in. Make sure you have saved it.
            </Text>
            <Pressable
              testID="confirm-signout-btn"
              onPress={onSignOut}
              style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.dangerBtnText}>Yes, sign out</Text>
            </Pressable>
            <Pressable onPress={() => setSignOutOpen(false)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function maskCode(code: string): string {
  return code.slice(0, 4) + " •••• •••• " + code.slice(-4);
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  hi: { color: colors.muted, fontSize: 14 },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "800", marginTop: 2 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  iconBtnText: { fontSize: 18, color: colors.onSurface },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  myCodeCard: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.brandTertiary,
  },
  myCodeLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  myCodeValue: {
    color: colors.onSurfaceTertiary,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: 2,
  },
  lobbyCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lobbyLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  lobbyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  lobbyBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  lobbyName: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  lobbyMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  lobbyCode: {
    fontWeight: "800",
    color: colors.brandPrimary,
    letterSpacing: 1,
  },
  chev: { color: colors.muted, fontSize: 26, paddingLeft: 8 },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: "center", paddingHorizontal: 20 },
  bottomBar: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: "row",
    gap: 10,
  },
  joinBtn: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
  },
  joinBtnText: { color: colors.onSurfaceTertiary, fontWeight: "800", fontSize: 15 },
  createBtn: {
    flex: 1.4,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
  },
  createBtnText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    gap: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurfaceSecondary },
  modalSub: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  modalInput: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.onSurface,
    marginTop: 6,
  },
  codeInput: {
    letterSpacing: 4,
    fontWeight: "800",
    textAlign: "center",
    fontSize: 20,
  },
  charCount: { color: colors.muted, fontSize: 12, textAlign: "right" },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 16 },
  dangerBtn: {
    backgroundColor: colors.error,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 8,
  },
  dangerBtnText: { color: colors.onError, fontWeight: "800", fontSize: 16 },
  linkBtn: { alignItems: "center", paddingVertical: 12 },
  linkText: { color: colors.muted, fontSize: 14 },
}));
