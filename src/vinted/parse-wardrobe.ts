import { TITLE_MAX_CHARS } from "../core/constants";
import { isVintedHttpUrl } from "../core/hosts";
import { formatCents, parseCents } from "../core/money";
import type { SellingStatus, WardrobeItem } from "../core/types";

/**
 * Reads only fields the payload actually carries.
 * Buyer-protection totals are not the seller's price and are ignored.
 * `status` on the public item payload is often the condition label, so it is
 * not copied into the selling-status column.
 */
export function parseWardrobeItems(rawItems: unknown[], origin: string): WardrobeItem[] {
  const seen = new Set<string>();
  const items: WardrobeItem[] = [];
  for (const raw of rawItems) {
    const item = parseWardrobeItem(raw, origin);
    if (!item) continue;
    if (item.id && seen.has(item.id)) continue;
    if (item.id) seen.add(item.id);
    items.push(item);
  }
  return items;
}

export function parseWardrobeItem(raw: unknown, origin: string): WardrobeItem | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = numericId(record.id) ?? "";
  const title = readTitle(record.title);
  const money = readMoney(record);
  const status = readSellingStatus(record);
  const url = readUrl(record, origin, id);
  if (!id && !title && !money.price) return null;
  return { id, title, price: money.price, currency: money.currency, status, url };
}

export function numericId(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;
  return null;
}

export function readCurrentUser(json: unknown): { ok: true; id: string; login: string } | { ok: false } {
  if (!json || typeof json !== "object") return { ok: false };
  const record = json as Record<string, unknown>;
  const user = record.user && typeof record.user === "object"
    ? record.user as Record<string, unknown>
    : record;
  const id = numericId(user.id);
  if (!id) return { ok: false };
  const login = typeof user.login === "string" ? user.login.trim().slice(0, 80) : "";
  return { ok: true, id, login };
}

export function readWardrobePage(json: unknown): { ok: true; items: unknown[]; totalPages: number | null } | { ok: false } {
  if (!json || typeof json !== "object") return { ok: false };
  const record = json as Record<string, unknown>;
  if (!Array.isArray(record.items)) return { ok: false };
  return { ok: true, items: record.items, totalPages: readTotalPages(record) };
}

function readTotalPages(record: Record<string, unknown>): number | null {
  const pagination = record.pagination && typeof record.pagination === "object"
    ? record.pagination as Record<string, unknown>
    : null;
  const candidates = [pagination?.total_pages, record.total_pages];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 1) return candidate;
  }
  return null;
}

function readTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, TITLE_MAX_CHARS);
}

function readMoney(record: Record<string, unknown>): { price: string; currency: string } {
  if (record.price && typeof record.price === "object") {
    const object = record.price as Record<string, unknown>;
    if ("amount" in object || "value" in object) {
      const amount = formatPrice(object.amount ?? object.value);
      const currency = currencyCode(object.currency_code) || currencyCode(object.currency) || currencyFrom(record);
      return { price: amount, currency: amount ? currency : "" };
    }
  }
  const direct = priceAndCurrency(record.price, record);
  if (direct.price) return direct;
  if ("price" in record && record.price != null) {
    return { price: "", currency: "" };
  }
  const numeric = formatPrice(record.price_numeric);
  if (numeric) return { price: numeric, currency: currencyFrom(record) };
  return { price: "", currency: "" };
}

function priceAndCurrency(price: unknown, record: Record<string, unknown>): { price: string; currency: string } {
  if (typeof price === "number" || typeof price === "string") {
    return { price: formatPrice(price), currency: currencyFrom(record) };
  }
  if (price && typeof price === "object") {
    const object = price as Record<string, unknown>;
    const amount = formatPrice(object.amount ?? object.value);
    const currency = currencyCode(object.currency_code) || currencyCode(object.currency) || currencyFrom(record);
    return { price: amount, currency: amount ? currency : currency };
  }
  return { price: "", currency: "" };
}

function currencyFrom(record: Record<string, unknown>): string {
  return currencyCode(record.currency) || currencyCode(record.currency_code) || currencyCode(record.price_currency);
}

function currencyCode(value: unknown): string {
  if (typeof value !== "string") return "";
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "";
}

function formatPrice(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return "";
    const cents = parseCents(String(value));
    return cents == null ? "" : formatCents(cents);
  }
  if (typeof value !== "string") return "";
  const cents = parseCents(value);
  return cents == null ? "" : formatCents(cents);
}

function readSellingStatus(record: Record<string, unknown>): SellingStatus {
  const draft = flag(record.is_draft);
  const hidden = flag(record.is_hidden);
  const reserved = flag(record.is_reserved);
  const closed = flag(record.is_closed);
  if (draft === true) return "draft";
  if (hidden === true) return "hidden";
  if (reserved === true) return "reserved";
  if (closed === true) return "closed";
  if ([draft, hidden, reserved, closed].some((value) => value === false)) return "active";
  return "";
}

function flag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readUrl(record: Record<string, unknown>, origin: string, id: string): string {
  if (typeof record.url === "string" && isVintedHttpUrl(record.url.trim())) {
    return record.url.trim().split("#")[0];
  }
  if (typeof record.path === "string") {
    const path = record.path.trim();
    if (path.startsWith("/") && !path.startsWith("//")) {
      const joined = `${origin}${path.split("#")[0]}`;
      if (isVintedHttpUrl(joined)) return joined;
    }
  }
  if (id && isVintedHttpUrl(origin)) {
    return `${origin}/items/${id}`;
  }
  return "";
}
