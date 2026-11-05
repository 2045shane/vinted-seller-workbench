import { emptyUsage, normalizeUsageMap, pruneUsage } from "../core/caps";
import { LICENSE_STORAGE_KEY, USAGE_STORAGE_KEY } from "../core/constants";
import { normalizeLicense, type LicenseStore } from "../core/license";
import type { UsageStore } from "../core/usage-store";
import type { DayUsage } from "../core/types";

export function chromeUsageStore(): UsageStore {
  return {
    async read(today) {
      const stored = await chrome.storage.local.get(USAGE_STORAGE_KEY);
      const map = pruneUsage(normalizeUsageMap(stored[USAGE_STORAGE_KEY]), today);
      return map[today] ?? emptyUsage();
    },
    async add(today, delta) {
      const stored = await chrome.storage.local.get(USAGE_STORAGE_KEY);
      const map = pruneUsage(normalizeUsageMap(stored[USAGE_STORAGE_KEY]), today);
      const current = map[today] ?? emptyUsage();
      const next: DayUsage = {
        repriceItems: current.repriceItems + safeInt(delta.repriceItems),
        csvRows: current.csvRows + safeInt(delta.csvRows),
      };
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: { ...map, [today]: next } });
      return next;
    },
  };
}

export function chromeLicenseStore(): LicenseStore {
  return {
    async isUnlocked() {
      const stored = await chrome.storage.local.get(LICENSE_STORAGE_KEY);
      return normalizeLicense(stored[LICENSE_STORAGE_KEY]);
    },
    async setUnlocked(unlocked) {
      if (!unlocked) {
        await chrome.storage.local.remove(LICENSE_STORAGE_KEY);
        return;
      }
      await chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: { unlocked: true } });
    },
  };
}

function safeInt(value: number | undefined): number {
  if (value == null || !Number.isInteger(value) || value < 0) return 0;
  return value;
}
