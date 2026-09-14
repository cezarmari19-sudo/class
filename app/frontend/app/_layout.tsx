import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CrashLogGate } from "@/src/components/crash-log-viewer";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastHost } from "@/src/components/toast";
import { queryClient } from "@/src/query-client";
import { saveCrashLog } from "@/src/utils/crash-log";

LogBox.ignoreAllLogs(true);

// Catch errors outside of React's render (async event handlers, unhandled
// promise rejections) that the ErrorBoundary below cannot see.
const ErrorUtilsGlobal = (global as any).ErrorUtils;
if (ErrorUtilsGlobal) {
  const defaultHandler = ErrorUtilsGlobal.getGlobalHandler();
  ErrorUtilsGlobal.setGlobalHandler((error: Error, isFatal?: boolean) => {
    saveCrashLog(error, isFatal ? "fatal (global handler)" : "non-fatal (global handler)");
    defaultHandler(error, isFatal);
  });
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <CrashLogGate>
              <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
              <ToastHost />
            </CrashLogGate>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}