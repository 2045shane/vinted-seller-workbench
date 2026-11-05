import { formatCents, parseCents } from "../core/money";
import { numericId } from "./parse-wardrobe";

export function mergePriceIntoDraft(
  json: unknown,
  newPrice: string,
): { ok: true; body: { item: Record<string, unknown> } } | { ok: false; message: string } {
  const cents = parseCents(newPrice);
  if (cents == null) {
    return { ok: false, message: "The new price was empty, so it was left unchanged." };
  }
  if (!json || typeof json !== "object") {
    return { ok: false, message: "Vinted's edit response did not include an item id. The price was not changed." };
  }
  const root = json as Record<string, unknown>;
  const nested = root.item;
  const source = isDraft(nested) ? nested : isDraft(root) ? root : null;
  if (!source) {
    return { ok: false, message: "Vinted's edit response did not include an item id. The price was not changed." };
  }
  const item: Record<string, unknown> = { ...source };
  writePrice(item, formatCents(cents));
  return { ok: true, body: { item } };
}

function isDraft(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return numericId((value as Record<string, unknown>).id) != null;
}

function writePrice(item: Record<string, unknown>, amount: string): void {
  if (typeof item.price === "number") item.price = Number(amount);
  else if (typeof item.price === "string") item.price = amount;
  else if (item.price && typeof item.price === "object" && !Array.isArray(item.price)) {
    item.price = { ...(item.price as Record<string, unknown>), amount };
  } else {
    item.price = amount;
  }
  if (typeof item.price_numeric === "number") item.price_numeric = Number(amount);
  else if (typeof item.price_numeric === "string") item.price_numeric = amount;
}
