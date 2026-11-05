import { describe, expect, it } from "vitest";
import { checkCsv, checkReprice, meterFor, pruneUsage } from "../src/core/caps";
import { memoryLicenseStore, unlockMatches } from "../src/core/license";
import { memoryUsageStore } from "../src/core/usage-store";
import { emptyUsage } from "../src/core/caps";

describe("free caps", () => {
  it("allows the 25th reprice and blocks the 26th", () => {
    const usage = { repriceItems: 24, csvRows: 0 };
    expect(checkReprice(usage, 1, false).ok).toBe(true);
    expect(checkReprice({ repriceItems: 25, csvRows: 0 }, 1, false).ok).toBe(false);
    const blocked = checkReprice({ repriceItems: 10, csvRows: 0 }, 20, false);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.message).toContain("Card checkout is not in this version.");
  });

  it("allows 100 CSV rows and blocks 101", () => {
    expect(checkCsv({ repriceItems: 0, csvRows: 99 }, 1, false).ok).toBe(true);
    const blocked = checkCsv({ repriceItems: 0, csvRows: 100 }, 1, false);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.message).toContain("100");
  });

  it("does not spend a cap when the wardrobe is read", async () => {
    const store = memoryUsageStore();
    const before = await store.read("2026-11-05");
    expect(before).toEqual(emptyUsage());
    expect(store.snapshot()).toEqual({});
  });

  it("resets on the next local day and drops old days", async () => {
    const store = memoryUsageStore({ "2026-10-01": { repriceItems: 25, csvRows: 100 }, "2026-11-05": { repriceItems: 2, csvRows: 3 } });
    expect(await store.read("2026-11-06")).toEqual(emptyUsage());
    expect(store.snapshot()["2026-10-01"]).toBeUndefined();
    expect(pruneUsage({ "2026-11-05": { repriceItems: 1, csvRows: 1 } }, "2026-11-05")["2026-11-05"]).toBeDefined();
  });

  it("lifts both caps after the local unlock stub", () => {
    expect(unlockMatches("  VSW-STUB-UNLIMITED  ")).toBe(true);
    expect(unlockMatches("vsw-stub-unlimited")).toBe(false);
    expect(checkReprice({ repriceItems: 25, csvRows: 100 }, 100, true).ok).toBe(true);
    expect(checkCsv({ repriceItems: 25, csvRows: 100 }, 500, true).ok).toBe(true);
    expect(meterFor({ repriceItems: 25, csvRows: 100 }, true).repriceLimit).toBeNull();
  });

  it("stores only the unlocked flag", async () => {
    const license = memoryLicenseStore();
    expect(await license.isUnlocked()).toBe(false);
    await license.setUnlocked(true);
    expect(license.value()).toBe(true);
    await license.setUnlocked(false);
    expect(await license.isUnlocked()).toBe(false);
  });
});
