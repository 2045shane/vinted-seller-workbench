import {
  FREE_DAILY_CSV_ROWS,
  FREE_DAILY_REPRICE_ITEMS,
  USAGE_HISTORY_DAYS,
} from "./constants";
import {
  bothCapsReached,
  csvCapReached,
  csvWouldExceed,
  repriceCapReached,
  repriceWouldExceed,
} from "./copy";
import { addDays } from "./money";
import type { DayUsage, UsageMap, UsageMeter } from "./types";

export function emptyUsage(): DayUsage {
  return { repriceItems: 0, csvRows: 0 };
}

export function normalizeUsageMap(value: unknown): UsageMap {
  if (!value || typeof value !== "object") return {};
  const map: UsageMap = {};
  for (const [day, raw] of Object.entries(value)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    map[day] = {
      repriceItems: nonNegativeInt(record.repriceItems),
      csvRows: nonNegativeInt(record.csvRows),
    };
  }
  return map;
}

export function pruneUsage(map: UsageMap, today: string): UsageMap {
  const oldest = addDays(today, -(USAGE_HISTORY_DAYS - 1));
  const next: UsageMap = {};
  for (const [day, usage] of Object.entries(map)) {
    if (day >= oldest && day <= today) next[day] = usage;
  }
  return next;
}

export function meterFor(usage: DayUsage, unlocked: boolean): UsageMeter {
  if (unlocked) {
    return {
      unlocked: true,
      repriceUsed: usage.repriceItems,
      repriceLimit: null,
      csvUsed: usage.csvRows,
      csvLimit: null,
    };
  }
  return {
    unlocked: false,
    repriceUsed: usage.repriceItems,
    repriceLimit: FREE_DAILY_REPRICE_ITEMS,
    csvUsed: usage.csvRows,
    csvLimit: FREE_DAILY_CSV_ROWS,
  };
}

export function repriceRemaining(usage: DayUsage, unlocked: boolean): number | null {
  if (unlocked) return null;
  return Math.max(0, FREE_DAILY_REPRICE_ITEMS - usage.repriceItems);
}

export function csvRemaining(usage: DayUsage, unlocked: boolean): number | null {
  if (unlocked) return null;
  return Math.max(0, FREE_DAILY_CSV_ROWS - usage.csvRows);
}

export function checkReprice(
  usage: DayUsage,
  count: number,
  unlocked: boolean,
): { ok: true } | { ok: false; message: string } {
  if (count <= 0 || unlocked) return { ok: true };
  const remaining = repriceRemaining(usage, false) ?? 0;
  if (count <= remaining) return { ok: true };
  if (remaining === 0 && csvRemaining(usage, false) === 0) {
    return { ok: false, message: bothCapsReached() };
  }
  if (remaining === 0) return { ok: false, message: repriceCapReached() };
  return { ok: false, message: repriceWouldExceed(count, remaining) };
}

export function checkCsv(
  usage: DayUsage,
  rows: number,
  unlocked: boolean,
): { ok: true } | { ok: false; message: string } {
  if (rows <= 0 || unlocked) return { ok: true };
  const remaining = csvRemaining(usage, false) ?? 0;
  if (rows <= remaining) return { ok: true };
  if (remaining === 0 && repriceRemaining(usage, false) === 0) {
    return { ok: false, message: bothCapsReached() };
  }
  if (remaining === 0) return { ok: false, message: csvCapReached() };
  return { ok: false, message: csvWouldExceed(rows, remaining) };
}

function nonNegativeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return 0;
  return value;
}
