import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastHost } from "@/src/components/toast";
import { queryClient } from "@/src/query-client";

LogBox.ignoreAllLogs(true);

Sentry.init({
  dsn: "https://8a0f5faf5d5e4b88c34ceac80de68b06@o4512079794667520.ingest.de.sentry.io/4512079802400848",
  enableAutoSessionTracking: true,
  tracesSampleRate: 1.0,
  debug: false,
});

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
            <ToastHost />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}