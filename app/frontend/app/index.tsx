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
    (async () => {
      const code = await getAccountCode();
      if (!code) {
        router.replace("/auth");
        return;
      }
      try {
        await api.me();
        router.replace("/lobbies");
      } catch {
        router.replace("/auth");
      } finally {
        setReady(true);
      }
    })();
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
