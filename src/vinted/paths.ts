import { WARDROBE_PAGE_SIZE } from "../core/constants";

export function currentUserPath(): string {
  return "/api/v2/users/current";
}

export function userItemsPath(userId: string, page: number): string | null {
  if (!/^[1-9]\d*$/.test(userId)) return null;
  if (!Number.isInteger(page) || page < 1 || page > 10_000) return null;
  return `/api/v2/users/${userId}/items?page=${page}&per_page=${WARDROBE_PAGE_SIZE}`;
}

export function itemUploadPath(itemId: string): string | null {
  if (!/^[1-9]\d*$/.test(itemId)) return null;
  return `/api/v2/item_upload/items/${itemId}`;
}

export function isAllowedOp(
  op: { method?: unknown; path?: unknown; body?: unknown },
): op is { method: "GET" | "PUT"; path: string; body?: unknown } {
  if (!op || (op.method !== "GET" && op.method !== "PUT")) return false;
  if (typeof op.path !== "string") return false;
  if (!op.path.startsWith("/api/v2/")) return false;
  if (op.path.includes("//") || op.path.includes("\\") || op.path.includes("@") || op.path.includes(" ")) {
    return false;
  }
  if (op.path === currentUserPath() && op.method === "GET") return true;
  const items = new RegExp(
    `^/api/v2/users/[1-9]\\d*/items\\?page=[1-9]\\d*&per_page=${WARDROBE_PAGE_SIZE}$`,
  );
  if (op.method === "GET" && items.test(op.path)) return true;
  if (/^\/api\/v2\/item_upload\/items\/[1-9]\d*$/.test(op.path)) return true;
  return false;
}
