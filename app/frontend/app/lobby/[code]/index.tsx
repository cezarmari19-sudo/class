import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { api, Lobby, Member } from "@/src/api";
import { toast } from "@/src/components/toast";
import { scoreColor } from "@/src/components/score-gauge";
import { makeStyles, useTheme } from "@/src/theme";

export default function LobbyDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { code, created } = useLocalSearchParams<{ code: string; created?: string }>();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    if (!code) return;
    try {
      const l = await api.getLobby(String(code));
      setLobby(l);
      const m = await api.listMembers(l.id);
      setMembers(m);
    } catch (e: any) {
      toast(e?.message || "Failed to load lobby", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [code]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // if just created, show settings hint by copying code automatically? Just show the code prominently.
  useEffect(() => {
    if (created === "1") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [created]);

  const copyCode = async () => {
    if (!lobby) return;
    await Clipboard.setStringAsync(lobby.code);
    toast("Lobby code copied", "success");
    Haptics.selectionAsync().catch(() => {});
  };

  const onToggleScores = async (val: boolean) => {
    if (!lobby) return;
    setSavingSettings(true);
    try {
      const updated = await api.updateSettings(lobby.id, val);
      setLobby(updated);
      toast(val ? "Scores are now visible to all" : "Scores hidden from members", "success");
    } catch (e: any) {
      toast(e?.message || "Failed to update settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const onAddMember = async () => {
    if (!lobby) return;
    if (!addName.trim()) {
      toast("Name is required", "error");
      return;
    }
    if (addName.trim().length > 100) {
      toast("Name too long (max 100)", "error");
      return;
    }
    setAdding(true);
    try {
      await api.addMember(lobby.id, addName.trim());
      setAddOpen(false);
      setAddName("");
      await load();
      toast("Member added", "success");
    } catch (e: any) {
      toast(e?.message || "Failed to add member", "error");
    } finally {
      setAdding(false);
    }
  };

  const onDeleteLobby = async () => {
    if (!lobby) return;
    try {
      await api.deleteLobby(lobby.id);
      setDeleteConfirm(false);
      setSettingsOpen(false);
      toast("Lobby deleted", "success");
      router.replace("/lobbies");
    } catch (e: any) {
      toast(e?.message || "Failed to delete", "error");
    }
  };

  if (loading || !lobby) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="lobby-detail-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.lobbyName} numberOfLines={1}>{lobby.name}</Text>
          <Text style={styles.headerSub}>{members.length} member{members.length === 1 ? "" : "s"}{lobby.is_admin ? " · Admin" : ""}</Text>
        </View>
        {lobby.is_admin && (
          <Pressable
            testID="open-settings-btn"
            onPress={() => setSettingsOpen(true)}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>⚙</Text>
          </Pressable>
        )}
      </View>

      {/* Code hero */}
      <Pressable testID="copy-code-btn" onPress={copyCode} style={styles.codeHero}>
        <Text style={styles.codeLabel}>LOBBY CODE — tap to copy</Text>
        <Text style={styles.codeValue} testID="lobby-code-text">{lobby.code}</Text>
      </Pressable>

      {/* Members list */}
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
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
          <Text style={styles.sectionTitle}>Students</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyTitle}>No students yet</Text>
            <Text style={styles.emptySub}>
              {lobby.is_admin ? "Share the code above or add one manually." : "Waiting for others to join…"}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const hidden = item.score < 0;
          const initials = getInitials(item.display_name);
          const color = hidden ? colors.muted : scoreColor(item.score);
          return (
            <Pressable
              testID={`member-row-${item.id}`}
              onPress={() => router.push(`/lobby/${lobby.code}/member/${item.id}`)}
              style={({ pressed }) => [styles.memberRow, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.brandTertiary }]}>
                <Text style={[styles.avatarText, { color: colors.onBrandTertiary }]}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName} numberOfLines={1}>{item.display_name}</Text>
                <Text style={styles.memberJoined}>Joined {formatShort(item.joined_at)}</Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: color + "22", borderColor: color }]}>
                <Text style={[styles.scoreBadgeText, { color }]}>
                  {hidden ? "•••" : item.score}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      {lobby.is_admin && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            testID="add-member-btn"
            onPress={() => setAddOpen(true)}
            style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.createBtnText}>+ Add student</Text>
          </Pressable>
        </View>
      )}

      {/* Settings Modal */}
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalBg}>
          <Pressable style={{ flex: 1 }} onPress={() => setSettingsOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Lobby settings</Text>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Allow everyone to see scores</Text>
                <Text style={styles.settingSub}>When off, only you (admin) can see all scores.</Text>
              </View>
              <Switch
                testID="toggle-visible-scores"
                value={lobby.settings.allow_everyone_to_see_scores}
                onValueChange={onToggleScores}
                disabled={savingSettings}
                trackColor={{ true: colors.brandPrimary, false: colors.border }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <Pressable
              testID="delete-lobby-btn"
              onPress={() => setDeleteConfirm(true)}
              style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.dangerBtnText}>Delete lobby</Text>
            </Pressable>
            <Pressable onPress={() => setSettingsOpen(false)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Delete confirm */}
      <Modal visible={deleteConfirm} transparent animationType="fade" onRequestClose={() => setDeleteConfirm(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Delete this lobby?</Text>
            <Text style={styles.modalSub}>
              This removes all students, scores, history and settings. This action cannot be undone.
            </Text>
            <Pressable
              testID="confirm-delete-lobby-btn"
              onPress={onDeleteLobby}
              style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.dangerBtnText}>Yes, delete lobby</Text>
            </Pressable>
            <Pressable onPress={() => setDeleteConfirm(false)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add member */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <Pressable style={{ flex: 1 }} onPress={() => setAddOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add a student</Text>
            <Text style={styles.modalSub}>They will start with a score of 100.</Text>
            <TextInput
              testID="add-name-input"
              value={addName}
              onChangeText={setAddName}
              placeholder="Display name"
              placeholderTextColor={colors.muted}
              maxLength={100}
              style={styles.modalInput}
              autoFocus
            />
            <Text style={styles.charCount}>{addName.length}/100</Text>
            <Pressable
              testID="confirm-add-member-btn"
              onPress={onAddMember}
              disabled={adding}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }, adding && { opacity: 0.6 }]}
            >
              {adding ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryBtnText}>Add</Text>}
            </Pressable>
            <Pressable onPress={() => setAddOpen(false)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  iconBtnText: { fontSize: 22, color: colors.onSurface, fontWeight: "700" },
  lobbyName: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  headerSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  codeHero: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
  },
  codeLabel: {
    color: colors.brandTertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  codeValue: {
    color: colors.onSurfaceInverse,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 8,
    marginTop: 6,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  sectionTitle: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  memberRow: {
    backgroundColor: colors.surfaceSecondary,
    padding: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 999,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "800" },
  memberName: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  memberJoined: { color: colors.muted, fontSize: 12, marginTop: 2 },
  scoreBadge: {
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
  },
  scoreBadgeText: { fontSize: 18, fontWeight: "900" },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: "center", paddingHorizontal: 20 },
  bottomBar: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  createBtn: {
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
    gap: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurfaceSecondary },
  modalSub: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  settingLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  settingSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 8 },
  modalInput: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.onSurface,
    marginTop: 6,
  },
  charCount: { color: colors.muted, fontSize: 12, textAlign: "right" },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 4,
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
