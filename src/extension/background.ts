import { createWorkbench } from "../app/workbench";
import { noTabView } from "../app/present";
import { NO_TAB_DETAIL } from "../core/copy";
import type { ActionResult, Adjustment, VintedPort, WardrobeItem } from "../core/types";
import { chromeLicenseStore, chromeUsageStore } from "./chrome-stores";
import { findVintedTab } from "./tabs";

type Request =
  | { type: "refresh" }
  | { type: "apply"; items: WardrobeItem[]; itemIds: string[]; adjustment: Adjustment }
  | { type: "export"; items: WardrobeItem[]; itemIds: string[] | null }
  | { type: "unlock"; items: WardrobeItem[]; code: string }
  | { type: "lock"; items: WardrobeItem[] };

const workbench = createWorkbench({
  usage: chromeUsageStore(),
  license: chromeLicenseStore(),
  now: () => new Date(),
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handle(message).then(sendResponse);
  return true;
});

async function handle(message: unknown): Promise<ActionResult> {
  const request = parseRequest(message);
  if (!request) {
    const view = noTabView(await workbench.meter());
    return { view, notice: { kind: "error", text: "The popup sent a request this version does not understand. Nothing was changed." } };
  }
  if (request.type === "export") return workbench.exportCsv(request.items, request.itemIds);
  if (request.type === "unlock") return workbench.unlock(request.items, request.code);
  if (request.type === "lock") return workbench.lock(request.items);

  const tab = await findVintedTab();
  if (!tab) {
    const view = noTabView(await workbench.meter());
    return { view, notice: { kind: "error", text: NO_TAB_DETAIL } };
  }
  const port = tabPort(tab.id);
  if (request.type === "refresh") return workbench.refresh(port, tab.origin);
  return workbench.apply(port, tab.origin, request.items, request.itemIds, request.adjustment);
}

function tabPort(tabId: number): VintedPort {
  return {
    async request(op) {
      const response = await deliver(tabId, op);
      if (!response || typeof response !== "object" || !("kind" in response)) {
        return { httpStatus: 0, json: null, kind: "network" };
      }
      const raw = response as { httpStatus?: unknown; json?: unknown; kind?: unknown };
      if (raw.kind !== "json" && raw.kind !== "non-json" && raw.kind !== "network" && raw.kind !== "blocked") {
        return { httpStatus: 0, json: null, kind: "network" };
      }
      return {
        httpStatus: typeof raw.httpStatus === "number" ? raw.httpStatus : 0,
        json: raw.json ?? null,
        kind: raw.kind,
      };
    },
  };
}

async function deliver(tabId: number, op: { method: "GET" | "PUT"; path: string; body?: unknown }): Promise<unknown> {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "vinted-fetch", op });
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ["content.js"] });
      return await chrome.tabs.sendMessage(tabId, { type: "vinted-fetch", op });
    } catch {
      return { httpStatus: 0, json: null, kind: "network" };
    }
  }
}

function parseRequest(message: unknown): Request | null {
  if (!message || typeof message !== "object") return null;
  const record = message as Record<string, unknown>;
  if (record.type === "refresh") return { type: "refresh" };
  if (record.type === "export") return { type: "export", items: itemsOf(record.items), itemIds: idsOf(record.itemIds) };
  if (record.type === "unlock" && typeof record.code === "string") {
    return { type: "unlock", items: itemsOf(record.items), code: record.code };
  }
  if (record.type === "lock") return { type: "lock", items: itemsOf(record.items) };
  if (record.type === "apply" && isAdjustment(record.adjustment)) {
    return {
      type: "apply",
      items: itemsOf(record.items),
      itemIds: stringIds(record.itemIds),
      adjustment: record.adjustment,
    };
  }
  return null;
}

function itemsOf(value: unknown): WardrobeItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return [{
      id: typeof record.id === "string" ? record.id : "",
      title: typeof record.title === "string" ? record.title : "",
      price: typeof record.price === "string" ? record.price : "",
      currency: typeof record.currency === "string" ? record.currency : "",
      status: typeof record.status === "string" ? record.status : "",
      url: typeof record.url === "string" ? record.url : "",
    }];
  });
}

function idsOf(value: unknown): string[] | null {
  if (value == null) return null;
  return stringIds(value);
}

function stringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string");
}

function isAdjustment(value: unknown): value is Adjustment {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.mode === "percent" && Number.isInteger(record.basisPoints)) return true;
  return record.mode === "fixed"
    && (record.op === "add" || record.op === "subtract" || record.op === "set")
    && Number.isInteger(record.cents);
}
