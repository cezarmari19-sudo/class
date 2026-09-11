import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { api, setAccountCode } from "@/src/api";
import { toast } from "@/src/components/toast";
import { makeStyles, useTheme } from "@/src/theme";

export default function AuthScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mode, setMode] = useState<"welcome" | "login" | "created">("welcome");
  const [code, setCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await api.createAccount();
      setCode(res.account_code);
      setMode("created");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      toast(e?.message || "Failed to create account", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAfterCreate = async () => {
    await setAccountCode(code);
    router.replace("/lobbies");
  };

  const handleLogin = async () => {
    const normalized = inputCode.trim().toUpperCase();
    if (!normalized) {
      toast("Enter your account code", "error");
      return;
    }
    setLoading(true);
    try {
      await setAccountCode(normalized);
      await api.me(); // validates
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/lobbies");
    } catch (e: any) {
      toast("Invalid account code", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="auth-screen">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🎓</Text>
            </View>
            <Text style={styles.brand}>ClassLobby</Text>
            <Text style={styles.tagline}>Classroom scores, simplified.</Text>
          </View>

          {mode === "welcome" && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Get started</Text>
              <Text style={styles.cardSub}>
                No email, no password. We generate a private 16-character account code (like Mullvad) that only you keep.
              </Text>
              <Pressable
                testID="create-account-btn"
                onPress={handleCreate}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.pressed,
                  loading && { opacity: 0.6 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Create new account</Text>
                )}
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                testID="switch-to-login-btn"
                onPress={() => setMode("login")}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryBtnText}>I already have an account</Text>
              </Pressable>
            </View>
          )}

          {mode === "login" && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Enter your account code</Text>
              <Text style={styles.cardSub}>Paste the 16-character code you saved earlier.</Text>

              <View style={styles.inputWrap}>
                <TextInput
                  testID="account-code-input"
                  value={inputCode}
                  onChangeText={(t) => setInputCode(t.toUpperCase())}
                  placeholder="XXXXXXXXXXXXXXXX"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={20}
                  style={styles.input}
                />
                <Pressable
                  testID="toggle-code-visibility-btn"
                  onPress={() => setShowCode((v) => !v)}
                  style={styles.eyeBtn}
                >
                  <Text style={styles.eyeText}>{showCode ? "🙈" : "👁"}</Text>
                </Pressable>
              </View>

              <Pressable
                testID="login-btn"
                onPress={handleLogin}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.pressed,
                  loading && { opacity: 0.6 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Log in</Text>
                )}
              </Pressable>

              <Pressable
                testID="back-to-welcome-btn"
                onPress={() => setMode("welcome")}
                style={styles.linkBtn}
              >
                <Text style={styles.linkText}>← Back</Text>
              </Pressable>
            </View>
          )}

          {mode === "created" && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Save your account code</Text>
              <Text style={styles.cardSub}>
                This is the only way to log back in. Copy it and keep it safe — we cannot recover it.
              </Text>

              <View style={styles.codeBox} testID="new-account-code-box">
                <Text style={styles.codeText}>{code}</Text>
              </View>

              <Pressable
                testID="continue-after-create-btn"
                onPress={handleContinueAfterCreate}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryBtnText}>I saved it — Continue</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    padding: 20,
    flexGrow: 1,
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 44,
  },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.onSurface,
  },
  tagline: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  cardSub: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: {
    color: colors.onBrandPrimary,
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceTertiary,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.onSurfaceTertiary,
    fontWeight: "700",
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 4,
  },
  pressed: { opacity: 0.7 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.onSurface,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    letterSpacing: 2,
  },
  eyeBtn: {
    padding: 8,
  },
  eyeText: {
    fontSize: 18,
  },
  linkBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  linkText: {
    color: colors.muted,
    fontSize: 14,
  },
  codeBox: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.brandPrimary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginVertical: 8,
  },
  codeText: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: 3,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
}));
