import { useEffect, useState, type PropsWithChildren } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { makeStyles } from "@/src/theme";
import { clearCrashLog, getCrashLog } from "@/src/utils/crash-log";

export function CrashLogGate({ children }: PropsWithChildren) {
  const [log, setLog] = useState<string | null | "loading">("loading");
  const styles = useStyles();

  useEffect(() => {
    getCrashLog().then(setLog);
  }, []);

  if (log === "loading") {
    return null;
  }

  if (!log) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container} testID="crash-log-gate">
      <Text style={styles.title}>Last crash detected</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text selectable style={styles.text}>
          {log}
        </Text>
      </ScrollView>
      <Pressable
        onPress={async () => {
          await clearCrashLog();
          setLog(null);
        }}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Dismiss and continue</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  scroll: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  scrollContent: {
    padding: 12,
  },
  text: {
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  button: {
    marginTop: 16,
    backgroundColor: colors.brandPrimary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.onBrandPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
}));