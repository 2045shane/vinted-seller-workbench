/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { createWorkbench } from "../src/app/workbench";
import { FREE_DAILY_CSV_ROWS, FREE_DAILY_REPRICE_ITEMS } from "../src/core/constants";
import { memoryLicenseStore } from "../src/core/license";
import { localDay } from "../src/core/money";
import { memoryUsageStore } from "../src/core/usage-store";
import { mount } from "../src/ui/view";
import { FIXTURE_ORIGIN, createFixturePort } from "../preview/fixture-port";

async function readyText(root: HTMLElement): Promise<void> {
  await vi.waitUntil(() => root.querySelector('[data-phase="ready"]'));
}

describe("popup", () => {
  it("shows fixture listings, a preview, a partial failure, the cap, and the unlock stub", async () => {
    const port = createFixturePort();
    const usage = memoryUsageStore();
    const license = memoryLicenseStore();
    const workbench = createWorkbench({ usage, license, now: () => new Date(), sleep: async () => {} });
    const root = document.createElement("div");
    document.body.append(root);
    mount(root, {
      refresh: () => workbench.refresh(port, FIXTURE_ORIGIN),
      apply: (items, itemIds, adjustment) => workbench.apply(port, FIXTURE_ORIGIN, items, itemIds, adjustment),
      exportCsv: (items, itemIds) => workbench.exportCsv(items, itemIds),
      unlock: (items, code) => workbench.unlock(items, code),
      lock: (items) => workbench.lock(items),
    });
    await readyText(root);

    const prices = [...root.querySelectorAll<HTMLElement>('[data-testid="price"]')].map((node) => node.textContent);
    expect(prices).toContain("42.00 EUR");
    expect(prices).toContain("—");
    expect(prices).toContain("5.00 EUR");
    expect(prices).not.toContain("20.00 EUR");
    expect(prices).not.toContain("9.00 EUR");
    expect(root.textContent).toContain("never asks for");
    expect(root.innerHTML).not.toContain('type="password"');

    expect(root.textContent).not.toContain("Very good");
    toggle(root, "101");
    toggle(root, "104");
    const percent = root.querySelector<HTMLInputElement>('[data-field="percent"]');
    if (!percent) throw new Error("missing percent field");
    percent.value = "-10";
    percent.dispatchEvent(new Event("input", { bubbles: true }));
    root.querySelector<HTMLFormElement>("[data-reprice]")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(root.querySelector('[data-testid="preview"]')?.textContent).toContain("37.80");
    expect(root.querySelector('[data-testid="preview"]')?.textContent).toContain("9.00");

    root.querySelector<HTMLButtonElement>('[data-action="apply"]')?.click();
    await vi.waitUntil(() => root.querySelector('[data-testid="results"]')?.textContent?.includes("Failed 1"));
    expect(root.textContent).toContain("Updated 1");
    expect(root.textContent).toContain("Editing is not allowed");
    expect(root.textContent).toContain("The price was not changed.");
    expect(port.calls.filter((call) => call.method === "PUT")).toHaveLength(2);

    const today = localDay(new Date());
    const current = await usage.read(today);
    await usage.add(today, {
      repriceItems: Math.max(0, FREE_DAILY_REPRICE_ITEMS - current.repriceItems),
      csvRows: Math.max(0, FREE_DAILY_CSV_ROWS - current.csvRows),
    });
    root.querySelector<HTMLButtonElement>('[data-action="refresh"]')?.click();
    await vi.waitUntil(() => root.querySelector('[data-testid="banner"]')?.textContent?.includes("Card checkout is not in this version."));

    const wrong = root.querySelector<HTMLInputElement>('[data-field="unlock"]');
    if (!wrong) throw new Error("missing unlock field");
    wrong.value = "nope";
    root.querySelector<HTMLButtonElement>('[data-action="unlock"]')?.click();
    await vi.waitUntil(() => root.textContent?.includes("does not match"));
    const again = root.querySelector<HTMLInputElement>('[data-field="unlock"]');
    if (!again) throw new Error("missing unlock field");
    again.value = "VSW-STUB-UNLIMITED";
    root.querySelector<HTMLButtonElement>('[data-action="unlock"]')?.click();
    await vi.waitUntil(() => root.querySelector('[data-testid="usage"]')?.textContent?.includes("unlimited"));
    root.remove();
  });

  it("shows a signed-out explanation and no invented listings", async () => {
    const port = createFixturePort();
    port.signedOut = true;
    const workbench = createWorkbench({
      usage: memoryUsageStore(),
      license: memoryLicenseStore(),
      now: () => new Date(),
      sleep: async () => {},
    });
    const root = document.createElement("div");
    document.body.append(root);
    mount(root, {
      refresh: () => workbench.refresh(port, FIXTURE_ORIGIN),
      apply: (items, itemIds, adjustment) => workbench.apply(port, FIXTURE_ORIGIN, items, itemIds, adjustment),
      exportCsv: (items, itemIds) => workbench.exportCsv(items, itemIds),
      unlock: (items, code) => workbench.unlock(items, code),
      lock: (items) => workbench.lock(items),
    });
    await vi.waitUntil(() => root.querySelector('[data-phase="signed-out"]'));
    expect(root.textContent).toContain("never asks for it");
    expect(root.querySelector('[data-testid="price"]')).toBeNull();
    expect(port.calls.map((call) => call.path)).toEqual(["/api/v2/users/current"]);
    root.remove();
  });
});

function toggle(root: ParentNode, id: string): void {
  const node = box(root, id);
  node.checked = true;
  node.dispatchEvent(new Event("change", { bubbles: true }));
}

function box(root: ParentNode, id: string): HTMLInputElement {
  const node = root.querySelector<HTMLInputElement>(`[data-item-id="${id}"]`);
  if (!node) throw new Error(`missing item ${id}`);
  return node;
}
