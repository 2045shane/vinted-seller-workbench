import { describe, expect, it } from "vitest";
import { buildCsv, CSV_COLUMNS } from "../src/core/csv";
import type { WardrobeItem } from "../src/core/types";

const stamp = "2026-11-05T01:02:03.000Z";

function item(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: "101",
    title: "Navy wool coat",
    price: "42.00",
    currency: "EUR",
    status: "active",
    url: "https://www.vinted.fr/items/101",
    ...overrides,
  };
}

describe("csv", () => {
  it("writes the required UTF-8 columns and leaves blanks empty", () => {
    const csv = buildCsv([
      item(),
      item({ id: "102", title: "", price: "", currency: "", status: "", url: "" }),
    ], stamp);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.includes("\r\n")).toBe(true);
    const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe(CSV_COLUMNS.map((column) => `"${column}"`).join(","));
    expect(lines[1]).toContain('"101"');
    expect(lines[1]).toContain('"42.00"');
    expect(lines[1]).toContain(`"${stamp}"`);
    expect(lines[2]).toBe(`"102","","","","","","${stamp}"`);
  });

  it("escapes quotes, commas, and formula text", () => {
    const csv = buildCsv([item({ title: 'Coat, "navy"', id: "=1+1" })], stamp);
    expect(csv).toContain('"Coat, ""navy"""');
    expect(csv).toContain(`"'=1+1"`);
  });

  it("uses one timestamp for every row", () => {
    const csv = buildCsv([item(), item({ id: "2" })], stamp);
    expect(csv.match(/2026-11-05T01:02:03.000Z/g)).toHaveLength(2);
  });
});
