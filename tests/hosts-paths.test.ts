import { describe, expect, it } from "vitest";
import { hostPatterns, isVintedHostname, isVintedHttpUrl } from "../src/core/hosts";
import { isAllowedOp, itemUploadPath, userItemsPath } from "../src/vinted/paths";
import { pickVintedTab } from "../src/extension/tabs";
import { WARDROBE_PAGE_SIZE } from "../src/core/constants";

describe("vinted hosts", () => {
  it("matches public country sites and rejects lookalikes", () => {
    expect(isVintedHostname("www.vinted.fr")).toBe(true);
    expect(isVintedHostname("vinted.co.uk")).toBe(true);
    expect(isVintedHostname("www.vinted.co.uk")).toBe(true);
    expect(isVintedHostname("vinted.fr.evil.com")).toBe(false);
    expect(isVintedHostname("notvinted.fr")).toBe(false);
    expect(isVintedHostname("evil-vinted.com")).toBe(false);
    expect(isVintedHttpUrl("http://www.vinted.fr/items/1")).toBe(false);
    expect(isVintedHttpUrl("https://www.vinted.de/items/1")).toBe(true);
  });

  it("builds manifest patterns for the apex and subdomains", () => {
    const patterns = hostPatterns(["vinted.fr", "vinted.co.uk"]);
    expect(patterns).toContain("https://vinted.fr/*");
    expect(patterns).toContain("https://*.vinted.fr/*");
    expect(patterns).toContain("https://*.vinted.co.uk/*");
    expect(patterns.every((pattern) => pattern.startsWith("https://"))).toBe(true);
  });

  it("prefers the active Vinted tab", () => {
    const picked = pickVintedTab([
      { id: 1, url: "https://www.vinted.fr/member/1", active: false, lastAccessed: 50 },
      { id: 2, url: "https://example.com", active: true, lastAccessed: 99 },
      { id: 3, url: "https://www.vinted.de/items/9", active: true, lastAccessed: 10 },
    ]);
    expect(picked?.id).toBe(3);
  });
});

describe("session paths", () => {
  it("allows only same-origin wardrobe and edit paths", () => {
    const items = userItemsPath("555", 1);
    expect(items).toBe(`/api/v2/users/555/items?page=1&per_page=${WARDROBE_PAGE_SIZE}`);
    expect(isAllowedOp({ method: "GET", path: "/api/v2/users/current" })).toBe(true);
    expect(isAllowedOp({ method: "GET", path: items })).toBe(true);
    expect(isAllowedOp({ method: "PUT", path: itemUploadPath("104") })).toBe(true);
    expect(isAllowedOp({ method: "GET", path: "https://evil.example/api/v2/users/current" })).toBe(false);
    expect(isAllowedOp({ method: "GET", path: "//evil.example/api/v2/users/current" })).toBe(false);
    expect(isAllowedOp({ method: "PUT", path: "/api/v2/users/current" })).toBe(false);
    expect(isAllowedOp({ method: "POST", path: "/api/v2/items" })).toBe(false);
    expect(userItemsPath("abc", 1)).toBeNull();
  });
});
