import { emptyUsage, normalizeUsageMap, pruneUsage } from "./caps";
import type { DayUsage, UsageMap } from "./types";

export type UsageStore = {
  read(today: string): Promise<DayUsage>;
  add(today: string, delta: Partial<DayUsage>): Promise<DayUsage>;
};

export function memoryUsageStore(initial: UsageMap = {}): UsageStore & { snapshot(): UsageMap } {
  let map = normalizeUsageMap(initial);
  return {
    async read(today) {
      map = pruneUsage(map, today);
      return map[today] ?? emptyUsage();
    },
    async add(today, delta) {
      map = pruneUsage(map, today);
      const current = map[today] ?? emptyUsage();
      const next = {
        repriceItems: current.repriceItems + nonNegative(delta.repriceItems),
        csvRows: current.csvRows + nonNegative(delta.csvRows),
      };
      map = { ...map, [today]: next };
      return next;
    },
    snapshot() {
      return map;
    },
  };
}

function nonNegative(value: number | undefined): number {
  if (value == null || !Number.isInteger(value) || value < 0) return 0;
  return value;
}
