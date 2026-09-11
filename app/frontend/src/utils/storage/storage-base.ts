// Base class for the Storage implementation in ./index.ts.
// Provides the shared JSON-serialization helper (`retrieve`) and the
// silent-failure logger (`warn`) used by every method in Storage.

export type StorageItemValue = string | number | boolean | null;

export abstract class StorageBase {
  // Public API surface — declared here (as abstract) purely so `keyof
  // StorageBase` includes them, which is what makes the AssertNoExtras
  // guard in index.ts work. The real implementations live in Storage.
  abstract getItem<Fallback extends StorageItemValue>(
    key: string,
    fallback: Fallback,
  ): Promise<Fallback | null>;
  abstract setItem<Value extends StorageItemValue>(key: string, value: Value): Promise<boolean>;
  abstract removeItem(key: string): Promise<boolean>;
  abstract secureGet<Fallback extends StorageItemValue>(
    key: string,
    fallback: Fallback,
  ): Promise<Fallback | null>;
  abstract secureSet<Value extends StorageItemValue>(key: string, value: Value): Promise<boolean>;
  abstract secureRemove(key: string): Promise<boolean>;

  // Parses a raw string read from AsyncStorage/SecureStore back into its
  // original type. Returns `fallback` on any miss or parse failure so a
  // missing key is indistinguishable from a stored `null` at the call site.
  protected retrieve<Fallback extends StorageItemValue>(
    raw: string | null,
    fallback: Fallback,
  ): Fallback | null {
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as Fallback | null;
    } catch {
      return fallback;
    }
  }

  // Storage helpers never throw; failures are logged (dev only) and
  // swallowed so callers always get a predictable fallback/false result.
  protected warn(method: string, key: string, error: unknown): void {
    if (__DEV__) {
      console.warn(`[storage] ${method} failed for key "${key}":`, error);
    }
  }
}

// Compile-time guard used by index.ts: ensures Storage doesn't declare any
// public method beyond what's declared here, catching accidental API drift.
// Usage: type _NoExtras = AssertNoExtras<Exclude<keyof Storage, keyof StorageBase>>;
// If Storage adds a method not declared here, that Exclude produces a
// non-never union, which fails to satisfy `extends never` below.
export type AssertNoExtras<T extends never = never> = T;
