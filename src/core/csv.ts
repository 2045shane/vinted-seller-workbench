import type { WardrobeItem } from "./types";

export const CSV_COLUMNS = [
  "id",
  "title",
  "price",
  "currency",
  "status",
  "url",
  "exported_at",
] as const;

const FORMULA_START = /^[=+\-@\t\r]/;

export function buildCsv(items: readonly WardrobeItem[], exportedAt: string): string {
  const lines = [CSV_COLUMNS.map(quoteField).join(",")];
  for (const item of items) {
    const row = [
      item.id,
      item.title,
      item.price,
      item.currency,
      item.status,
      item.url,
      exportedAt,
    ];
    lines.push(row.map(quoteField).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function csvFilename(day: string): string {
  return `vinted-wardrobe-${day}.csv`;
}

function quoteField(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
