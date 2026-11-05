import { describe, expect, it } from "vitest";
import { createWorkbench } from "../src/app/workbench";
import { memoryLicenseStore } from "../src/core/license";
import { memoryUsageStore } from "../src/core/usage-store";
import type { RawResponse, VintedPort, WardrobeItem } from "../src/core/types";
import { REPRICE_REQUEST_GAP_MS, WARDROBE_MAX_PAGES, WARDROBE_PAGE_SIZE } from "../src/core/constants";

const origin = "https://www.vinted.fr";
const day = new Date(2026, 10, 5, 12, 0, 0);

function deps(options: { unlocked?: boolean; repriceItems?: number; csvRows?: number; sleep?: (ms: number) => Promise<void> } = {}) {
  return {
    usage: memoryUsageStore(options.repriceItems || options.csvRows ? { "2026-11-05": { repriceItems: options.repriceItems ?? 0, csvRows: options.csvRows ?? 0 } } : {}),
    license: memoryLicenseStore(options.unlocked ?? false),
    now: () => day,
    sleep: options.sleep ?? (async () => {}),
  };
}

function json(httpStatus: number, body: unknown): RawResponse {
  return { httpStatus, kind: "json", json: body };
}

describe("workbench session", () => {
  it("loads the signed-in wardrobe and does not spend a cap", async () => {
    const calls: string[] = [];
    const port: VintedPort = {
      async request(op) {
        calls.push(op.path);
        if (op.path === "/api/v2/users/current") return json(200, { user: { id: 555, login: "ada" } });
        if (op.path.includes("page=1")) {
          return json(200, {
            items: [
              { id: 1, title: "Coat", price: { amount: "42.00", currency_code: "EUR" }, is_closed: false },
              { id: 2, title: "Scarf", total_item_price: "20.00", status: "Very good" },
            ],
            pagination: { total_pages: 2 },
          });
        }
        return json(200, { items: [{ id: 3, title: "Hat", price: "5.00", currency: "EUR", is_closed: false }], pagination: { total_pages: 2 } });
      },
    };
    const setup = deps();
    const result = await createWorkbench(setup).refresh(port, origin);
    expect(result.view.phase).toBe("ready");
    expect(result.view.items.map((item) => item.price)).toEqual(["42.00", "", "5.00"]);
    expect(result.view.items[1]?.status).toBe("");
    expect(result.view.accountLabel).toBe("Signed in as ada");
    expect(calls).toEqual([
      "/api/v2/users/current",
      `/api/v2/users/555/items?page=1&per_page=${WARDROBE_PAGE_SIZE}`,
      `/api/v2/users/555/items?page=2&per_page=${WARDROBE_PAGE_SIZE}`,
    ]);
    expect(setup.usage.snapshot()).toEqual({});
  });

  it("stops with a signed-out state and does not request listings", async () => {
    const calls: string[] = [];
    const port: VintedPort = {
      async request(op) {
        calls.push(op.path);
        return json(401, { message: "Invalid token" });
      },
    };
    const result = await createWorkbench(deps()).refresh(port, origin);
    expect(result.view.phase).toBe("signed-out");
    expect(result.view.detail).toContain("never asks for it");
    expect(result.view.items).toEqual([]);
    expect(calls).toEqual(["/api/v2/users/current"]);
  });

  it("applies each listing on its own and keeps a failure from stopping the rest", async () => {
    const calls: { path: string; method: string; body?: unknown }[] = [];
    const slept: number[] = [];
    const port: VintedPort = {
      async request(op) {
        calls.push(op);
        const id = op.path.split("/").pop();
        if (op.method === "GET") {
          return json(200, { item: { id: Number(id), description: "wool", price: "42.00" } });
        }
        if (id === "2") throw new Error("socket closed");
        if (id === "3") return json(403, { message: "Editing is not allowed for this listing" });
        return json(200, { item: { id: Number(id), price: "37.80" } });
      },
    };
    const items: WardrobeItem[] = [
      { id: "1", title: "Coat", price: "42.00", currency: "EUR", status: "active", url: "" },
      { id: "2", title: "Boots", price: "42.00", currency: "EUR", status: "active", url: "" },
      { id: "3", title: "Hat", price: "42.00", currency: "EUR", status: "active", url: "" },
      { id: "4", title: "Scarf", price: "", currency: "", status: "reserved", url: "" },
    ];
    const setup = deps({ sleep: async (ms) => { slept.push(ms); } });
    const result = await createWorkbench(setup).apply(port, origin, items, ["1", "2", "3", "4"], { mode: "percent", basisPoints: -1000 });
    expect(result.notice?.kind).toBe("apply-result");
    if (result.notice?.kind === "apply-result") {
      expect(result.notice.updated.map((row) => row.id)).toEqual(["1"]);
      expect(result.notice.failed.map((row) => row.id)).toEqual(["4", "2", "3"]);
      expect(result.notice.failed[1]?.message).toContain("The price was not changed.");
      expect(result.notice.failed[2]?.message).toBe(
        "Editing is not allowed for this listing. The price was not changed.",
      );
      expect(result.notice.failed[0]?.message).toContain("no price");
    }
    expect(result.view.items[0]?.price).toBe("37.80");
    expect(result.view.usage.repriceUsed).toBe(1);
    const puts = calls.filter((call) => call.method === "PUT");
    expect(puts.map((call) => call.path)).toEqual([
      "/api/v2/item_upload/items/1",
      "/api/v2/item_upload/items/2",
      "/api/v2/item_upload/items/3",
    ]);
    expect(puts[0]?.body).toEqual({ item: { id: 1, description: "wool", price: "37.80" } });
    expect(slept).toEqual([REPRICE_REQUEST_GAP_MS, REPRICE_REQUEST_GAP_MS]);
  });

  it("does not write anything when the selection would pass the daily cap", async () => {
    const calls: string[] = [];
    const port: VintedPort = {
      async request(op) {
        calls.push(op.method);
        return json(200, {});
      },
    };
    const items = [item("1"), item("2")];
    const result = await createWorkbench(deps({ repriceItems: 24 })).apply(
      port,
      origin,
      items,
      ["1", "2"],
      { mode: "fixed", op: "set", cents: 1500 },
    );
    expect(calls).toEqual([]);
    expect(result.view.banner).toContain("Card checkout is not in this version.");
    expect(result.view.usage.repriceUsed).toBe(24);
  });

  it("stops after the safety page bound and says so", async () => {
    let pages = 0;
    const port: VintedPort = {
      async request(op) {
        if (op.path === "/api/v2/users/current") return json(200, { user: { id: 7, login: "" } });
        pages += 1;
        const items = Array.from({ length: WARDROBE_PAGE_SIZE }, (_, index) => {
          const id = (pages - 1) * WARDROBE_PAGE_SIZE + index + 1;
          return { id, title: `Item ${id}`, price: "3.00", currency: "EUR", is_closed: false };
        });
        return json(200, { items });
      },
    };
    const result = await createWorkbench(deps()).refresh(port, origin);
    expect(pages).toBe(WARDROBE_MAX_PAGES);
    expect(result.view.items).toHaveLength(WARDROBE_MAX_PAGES * WARDROBE_PAGE_SIZE);
    expect(result.view.truncatedNote).toContain("not the free-plan cap");
    expect(result.view.usage.repriceUsed).toBe(0);
  });

  it("exports the selected rows once and blocks the next export past 100", async () => {
    const setup = deps();
    const bench = createWorkbench(setup);
    const items = Array.from({ length: 60 }, (_, index) => item(String(index + 1)));
    const first = await bench.exportCsv(items, null);
    expect(first.csv?.text.startsWith("\uFEFF")).toBe(true);
    expect(first.csv?.text).toContain('"id","title","price","currency","status","url","exported_at"');
    expect(first.view.usage.csvUsed).toBe(60);
    const second = await bench.exportCsv(items, null);
    expect(second.csv).toBeUndefined();
    expect(second.view.banner).toContain("100");
    expect(second.view.usage.csvUsed).toBe(60);
  });

  it("rejects the wrong stub code and then lifts the cap", async () => {
    const setup = deps({ repriceItems: 25, csvRows: 100 });
    const bench = createWorkbench(setup);
    const wrong = await bench.unlock([], "nope");
    expect(wrong.notice).toMatchObject({ kind: "error" });
    expect(await setup.license.isUnlocked()).toBe(false);
    const right = await bench.unlock([item("1")], "VSW-STUB-UNLIMITED");
    expect(right.view.usage.unlocked).toBe(true);
    expect(right.view.items[0]?.id).toBe("1");
    const exported = await bench.exportCsv(Array.from({ length: 120 }, (_, index) => item(String(index + 1))), null);
    expect(exported.csv).toBeDefined();
  });
});

function item(id: string): WardrobeItem {
  return { id, title: `Item ${id}`, price: "10.00", currency: "EUR", status: "active", url: `${origin}/items/${id}` };
}
