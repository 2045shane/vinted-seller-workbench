import type { RawResponse } from "../core/types";
import { isAllowedOp } from "./paths";

const INSTALLED = "__vintedSellerWorkbenchFetch";

/**
 * Runs in the Vinted tab (isolated world). The browser attaches the existing
 * session cookies. The token is sent only back to that same Vinted origin.
 */
export async function performVintedFetch(op: unknown): Promise<RawResponse> {
  if (!isRecord(op) || !isAllowedOp(op)) {
    return { httpStatus: 0, json: null, kind: "blocked" };
  }
  try {
    const headers = new Headers();
    headers.set("Accept", "application/json");
    const csrf = readCsrf();
    if (csrf) headers.set("X-CSRF-Token", csrf);
    const anonId = readCookie("anon_id");
    if (anonId) headers.set("X-Anon-Id", anonId);
    const init: RequestInit = {
      method: op.method,
      credentials: "include",
      cache: "no-store",
      headers,
    };
    if (op.method === "PUT") {
      headers.set("Content-Type", "application/json");
      init.body = JSON.stringify(op.body ?? {});
    }
    const response = await fetch(op.path, init);
    const text = await response.text();
    if (!text.trim()) return { httpStatus: response.status, json: null, kind: "non-json" };
    try {
      return { httpStatus: response.status, json: JSON.parse(text) as unknown, kind: "json" };
    } catch {
      return { httpStatus: response.status, json: null, kind: "non-json" };
    }
  } catch {
    return { httpStatus: 0, json: null, kind: "network" };
  }
}

export function installContentFetchListener(): void {
  if (typeof window === "undefined" || window.top !== window) return;
  const scope = globalThis as typeof globalThis & { [INSTALLED]?: boolean };
  if (scope[INSTALLED]) return;
  scope[INSTALLED] = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "vinted-fetch") return;
    void performVintedFetch(message.op).then(sendResponse);
    return true;
  });
}

function readCsrf(): string {
  const meta = document.querySelector('meta[name="csrf-token"]');
  const content = meta?.getAttribute("content")?.trim() ?? "";
  return content;
}

function readCookie(name: string): string {
  const parts = document.cookie ? document.cookie.split(/; */) : [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return "";
}

function isRecord(value: unknown): value is { method?: unknown; path?: unknown; body?: unknown } {
  return !!value && typeof value === "object";
}
