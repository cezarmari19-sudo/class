import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { getAccountCode, api } from "@/src/api";
import { makeStyles } from "@/src/theme";

export default function Index() {
  const styles = useStyles();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const code = await getAccountCode();
      if (cancelled) return;
      if (!code) {
        router.replace("/auth");
        return;
      }
      try {
        await api.me();
        if (cancelled) return;
        router.replace("/lobbies");
      } catch {
        if (cancelled) return;
        router.replace("/auth");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <ActivityIndicator size="large" color="#00C853" />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
}));
