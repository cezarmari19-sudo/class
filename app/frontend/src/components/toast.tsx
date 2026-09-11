// Simple toast notification
import { useEffect, useRef, useState, useCallback } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/theme";

type ToastItem = { id: number; text: string; kind: "success" | "error" | "info" };

let pushRef: ((t: Omit<ToastItem, "id">) => void) | null = null;

export function toast(text: string, kind: ToastItem["kind"] = "info") {
  pushRef?.({ text, kind });
}

export function ToastHost() {
  const { colors } = useTheme();
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(1);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = counter.current++;
    setItems((s) => [...s, { ...t, id }]);
    setTimeout(() => {
      setItems((s) => s.filter((x) => x.id !== id));
    }, 2600);
  }, []);

  useEffect(() => {
    pushRef = push;
    return () => {
      if (pushRef === push) pushRef = null;
    };
  }, [push]);

  return (
    <View pointerEvents="none" style={styles.host} testID="toast-host">
      {items.map((it) => {
        const bg =
          it.kind === "error" ? colors.error : it.kind === "success" ? colors.success : colors.surfaceInverse;
        const fg =
          it.kind === "error" ? colors.onError : it.kind === "success" ? colors.onSuccess : colors.onSurfaceInverse;
        return (
          <ToastRow key={it.id} bg={bg} fg={fg} text={it.text} />
        );
      })}
    </View>
  );
}

function ToastRow({ bg, fg, text }: { bg: string; fg: string; text: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [opacity]);
  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity }]}>
      <Text style={[styles.toastText, { color: fg }]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: "center",
    gap: 8,
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    maxWidth: "90%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  toastText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
