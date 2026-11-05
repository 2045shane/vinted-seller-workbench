import type { WorkbenchClient } from "../ui/view";
import { mount } from "../ui/view";
import type { ActionResult, Adjustment, WardrobeItem } from "../core/types";

const client: WorkbenchClient = {
  refresh: () => send({ type: "refresh" }),
  apply: (items, itemIds, adjustment) => send({ type: "apply", items, itemIds, adjustment }),
  exportCsv: (items, itemIds) => send({ type: "export", items, itemIds }),
  unlock: (items, code) => send({ type: "unlock", items, code }),
  lock: (items) => send({ type: "lock", items }),
};

function send(message: {
  type: string;
  items?: WardrobeItem[];
  itemIds?: string[] | null;
  adjustment?: Adjustment;
  code?: string;
}): Promise<ActionResult> {
  return chrome.runtime.sendMessage(message);
}

const root = document.querySelector<HTMLElement>("#app");
if (root) mount(root, client);
