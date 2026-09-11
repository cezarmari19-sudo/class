import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { api, Lobby, Member, ScoreHistoryItem } from "@/src/api";
import { toast } from "@/src/components/toast";
import { ScoreGauge } from "@/src/components/score-gauge";
import { makeStyles, useTheme } from "@/src/theme";

const STEPS = [-10, -5, -1, 1, 5, 10];

export default function MemberScoreScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { code, memberId } = useLocalSearchParams<{ code: string; memberId: string }>();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [history, setHistory] = useState<ScoreHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualVal, setManualVal] = useState("");
  const [applyingManual, setApplyingManual] = useState(false);

  const [removeConfirm, setRemoveConfirm] = useState(false);

  const [busyStep, setBusyStep] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!code || !memberId) return;
    try {
      const l = await api.getLobby(String(code));
      setLobby(l);
      const m = await api.getMember(l.id, String(memberId));
      setMember(m);
      try {
        const h = await api.getHistory(l.id, String(memberId));
        setHistory(h);
      } catch {
        setHistory([]);
      }
    } catch (e: any) {
      toast(e?.message || "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [code, memberId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const applyChange = async (change: number) => {
    if (!lobby || !member) return;
    setBusyStep(change);
    try {
      const style =
        Math.abs(change) >= 10
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Math.abs(change) >= 5
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => {});
      const updated = await api.changeScore(lobby.id, member.id, change);
      setMember(updated);
      const h = await api.getHistory(lobby.id, member.id);
      setHistory(h);
    } catch (e: any) {
      toast(e?.message || "Failed to change score", "error");
    } finally {
      setBusyStep(null);
    }
  };

  const applyManual = async () => {
    const v = parseInt(manualVal, 10);
    if (Number.isNaN(v)) {
      toast("Enter a valid number", "error");
      return;
    }
    setApplyingManual(true);
    await applyChange(v);
    setApplyingManual(false);
    setManualOpen(false);
    setManualVal("");
  };

  const saveName = async () => {
    if (!lobby || !member) return;
    const val = nameDraft.trim();
    if (!val) {
      toast("Name required", "error");
      return;
    }
    if (val.length > 100) {
      toast("Max 100 characters", "error");
      return;
    }
    setSavingName(true);
    try {
      const updated = await api.editName(lobby.id, member.id, val);
      setMember(updated);
      setEditNameOpen(false);
      toast("Name updated", "success");
    } catch (e: any) {
      toast(e?.message || "Failed to update", "error");
    } finally {
      setSavingName(false);
    }
  };

  const removeMember = async () => {
    if (!lobby || !member) return;
    try {
      await api.removeMember(lobby.id, member.id);
      setRemoveConfirm(false);
      toast("Member removed", "success");
      router.back();
    } catch (e: any) {
      toast(e?.message || "Failed to remove", "error");
    }
  };

  if (loading || !member || !lobby) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      </View>
    );
  }

  const hidden = member.score < 0;
  const isAdmin = lobby.is_admin;
  const canSeeHistory = isAdmin || lobby.settings.allow_everyone_to_see_scores || !hidden;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="member-score-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.name} numberOfLines={2}>{member.display_name}</Text>
          <Text style={styles.sub}>{lobby.name}</Text>
        </View>
        {isAdmin && (
          <Pressable
            testID="edit-name-btn"
            onPress={() => {
              setNameDraft(member.display_name);
              setEditNameOpen(true);
            }}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>✎</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Gauge */}
        <View style={styles.gaugeWrap}>
          {hidden ? (
            <View style={styles.hiddenBox}>
              <Text style={styles.hiddenTitle}>Score hidden</Text>
              <Text style={styles.hiddenSub}>The teacher has kept scores private for this lobby.</Text>
            </View>
          ) : (
            <ScoreGauge score={member.score} size={280} />
          )}
        </View>

        {/* Admin controls */}
        {isAdmin && (
          <View style={styles.controls}>
            <Text style={styles.sectionTitle}>Adjust score</Text>
            <View style={styles.stepRow}>
              {STEPS.map((s) => (
                <Pressable
                  key={s}
                  testID={`step-${s}`}
                  onPress={() => applyChange(s)}
                  disabled={busyStep !== null}
                  style={({ pressed }) => [
                    styles.stepBtn,
                    s < 0 ? styles.stepMinus : styles.stepPlus,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[styles.stepText, { color: s < 0 ? colors.error : colors.success }]}
                  >
                    {s > 0 ? `+${s}` : s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              testID="open-manual-btn"
              onPress={() => setManualOpen(true)}
              style={({ pressed }) => [styles.manualBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.manualBtnText}>Enter custom value</Text>
            </Pressable>
            <Pressable
              testID="open-remove-btn"
              onPress={() => setRemoveConfirm(true)}
              style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.removeBtnText}>Remove from lobby</Text>
            </Pressable>
          </View>
        )}

        {/* History */}
        <View style={styles.historyWrap}>
          <Text style={styles.sectionTitle}>History</Text>
          {!canSeeHistory ? (
            <Text style={styles.historyEmpty}>History is private for this lobby.</Text>
          ) : history.length === 0 ? (
            <Text style={styles.historyEmpty}>No changes yet. Start at 100 / 100.</Text>
          ) : (
            history.map((h) => (
              <View
                key={h.id}
                testID={`history-row-${h.id}`}
                style={styles.historyRow}
              >
                <Text style={styles.historyTime}>{formatTime(h.timestamp)}</Text>
                <Text
                  style={[
                    styles.historyChange,
                    { color: h.change >= 0 ? colors.success : colors.error },
                  ]}
                >
                  {h.change >= 0 ? `+${h.change}` : h.change}
                </Text>
                <Text style={styles.historyResult}>
                  {h.previous_score} → {h.new_score}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit name modal */}
      <Modal visible={editNameOpen} transparent animationType="fade" onRequestClose={() => setEditNameOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <Pressable style={{ flex: 1 }} onPress={() => setEditNameOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Edit name</Text>
            <Text style={styles.modalSub}>Max 100 characters. Applies only within this lobby.</Text>
            <TextInput
              testID="edit-name-input"
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Display name"
              placeholderTextColor={colors.muted}
              maxLength={100}
              style={styles.modalInput}
              autoFocus
              multiline
            />
            <Text style={styles.charCount}>{nameDraft.length}/100</Text>
            <Pressable
              testID="save-name-btn"
              onPress={saveName}
              disabled={savingName}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }, savingName && { opacity: 0.6 }]}
            >
              {savingName ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryBtnText}>Save</Text>}
            </Pressable>
            <Pressable onPress={() => setEditNameOpen(false)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Manual score modal */}
      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <Pressable style={{ flex: 1 }} onPress={() => setManualOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Custom change</Text>
            <Text style={styles.modalSub}>
              Enter how much to add (positive) or subtract (negative). Score stays between 0 and 100.
            </Text>
            <TextInput
              testID="manual-input"
              value={manualVal}
              onChangeText={setManualVal}
              placeholder="e.g. -7 or 15"
              placeholderTextColor={colors.muted}
              keyboardType={Platform.select({ ios: "numbers-and-punctuation", default: "default" })}
              style={styles.modalInput}
              autoFocus
            />
            <Pressable
              testID="apply-manual-btn"
              onPress={applyManual}
              disabled={applyingManual}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }, applyingManual && { opacity: 0.6 }]}
            >
              {applyingManual ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryBtnText}>Apply</Text>}
            </Pressable>
            <Pressable onPress={() => setManualOpen(false)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Remove confirm */}
      <Modal visible={removeConfirm} transparent animationType="fade" onRequestClose={() => setRemoveConfirm(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Remove {member.display_name}?</Text>
            <Text style={styles.modalSub}>They will lose access to this lobby. History for this student will also be removed.</Text>
            <Pressable
              testID="confirm-remove-btn"
              onPress={removeMember}
              style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.removeBtnText}>Yes, remove</Text>
            </Pressable>
            <Pressable onPress={() => setRemoveConfirm(false)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
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
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  gaugeWrap: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: colors.surfaceSecondary,
    marginHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  hiddenBox: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  hiddenTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  hiddenSub: { color: colors.muted, marginTop: 6, textAlign: "center" },
  controls: {
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  stepBtn: {
    width: "31%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  stepMinus: {
    backgroundColor: "#FFEBEE",
    borderColor: "#FFCDD2",
  },
  stepPlus: {
    backgroundColor: "#E8F5E9",
    borderColor: "#C8E6C9",
  },
  stepText: {
    fontSize: 20,
    fontWeight: "900",
  },
  manualBtn: {
    backgroundColor: colors.surfaceTertiary,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  manualBtnText: { color: colors.onSurfaceTertiary, fontWeight: "700", fontSize: 15 },
  removeBtn: {
    backgroundColor: colors.error,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  removeBtnText: { color: colors.onError, fontWeight: "800", fontSize: 15 },
  historyWrap: { marginHorizontal: 20, marginTop: 8, gap: 6 },
  historyEmpty: {
    color: colors.muted,
    paddingVertical: 20,
    textAlign: "center",
    fontStyle: "italic",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyTime: { color: colors.muted, fontSize: 13, flex: 1 },
  historyChange: { fontSize: 16, fontWeight: "800", width: 60, textAlign: "center" },
  historyResult: { color: colors.onSurface, fontSize: 14, fontWeight: "700", width: 90, textAlign: "right" },
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
    minHeight: 48,
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
  linkBtn: { alignItems: "center", paddingVertical: 12 },
  linkText: { color: colors.muted, fontSize: 14 },
}));
