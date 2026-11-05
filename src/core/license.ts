import { LOCAL_LICENSE_UNLOCK_CODE } from "./constants";

export type LicenseStore = {
  isUnlocked(): Promise<boolean>;
  setUnlocked(unlocked: boolean): Promise<void>;
};

export function unlockMatches(code: string): boolean {
  return code.trim() === LOCAL_LICENSE_UNLOCK_CODE;
}

export function normalizeLicense(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return (value as { unlocked?: unknown }).unlocked === true;
}

export function memoryLicenseStore(initial = false): LicenseStore & { value(): boolean } {
  let unlocked = initial;
  return {
    async isUnlocked() {
      return unlocked;
    },
    async setUnlocked(next: boolean) {
      unlocked = next;
    },
    value() {
      return unlocked;
    },
  };
}
