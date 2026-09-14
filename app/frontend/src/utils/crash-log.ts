import AsyncStorage from "@react-native-async-storage/async-storage";

const CRASH_LOG_KEY = "debug:last-crash-log";

export async function saveCrashLog(error: unknown, context?: string): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? "" : "";
    const payload = JSON.stringify(
      {
        message,
        stack,
        context: context ?? "",
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
    await AsyncStorage.setItem(CRASH_LOG_KEY, payload);
  } catch {
    // Best-effort only; never throw from the crash logger itself.
  }
}

export async function getCrashLog(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CRASH_LOG_KEY);
  } catch {
    return null;
  }
}

export async function clearCrashLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CRASH_LOG_KEY);
  } catch {
    // ignore
  }
}