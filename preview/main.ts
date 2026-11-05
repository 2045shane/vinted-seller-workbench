import { createWorkbench } from "../src/app/workbench";
import { FREE_DAILY_CSV_ROWS, FREE_DAILY_REPRICE_ITEMS } from "../src/core/constants";
import { memoryLicenseStore } from "../src/core/license";
import { localDay } from "../src/core/money";
import { memoryUsageStore } from "../src/core/usage-store";
import { mount } from "../src/ui/view";
import { FIXTURE_ORIGIN, createFixturePort } from "./fixture-port";

const port = createFixturePort();
const usage = memoryUsageStore();
const license = memoryLicenseStore();
const workbench = createWorkbench({
  usage,
  license,
  now: () => new Date(),
  sleep: async () => {},
});

const root = document.querySelector<HTMLElement>("#app");
if (root) {
  mount(root, {
    refresh: () => workbench.refresh(port, FIXTURE_ORIGIN),
    apply: (items, itemIds, adjustment) => workbench.apply(port, FIXTURE_ORIGIN, items, itemIds, adjustment),
    exportCsv: (items, itemIds) => workbench.exportCsv(items, itemIds),
    unlock: (items, code) => workbench.unlock(items, code),
    lock: (items) => workbench.lock(items),
  });
}

document.querySelector("[data-fixture='reset']")?.addEventListener("click", () => {
  location.reload();
});

document.querySelector("[data-fixture='signed-out']")?.addEventListener("click", () => {
  port.signedOut = true;
  document.querySelector<HTMLButtonElement>('[data-action="refresh"]')?.click();
});

document.querySelector("[data-fixture='cap']")?.addEventListener("click", () => {
  void (async () => {
    const today = localDay(new Date());
    const current = await usage.read(today);
    await usage.add(today, {
      repriceItems: Math.max(0, FREE_DAILY_REPRICE_ITEMS - current.repriceItems),
      csvRows: Math.max(0, FREE_DAILY_CSV_ROWS - current.csvRows),
    });
    document.querySelector<HTMLButtonElement>('[data-action="refresh"]')?.click();
  })();
});
