import { MAX_AMOUNT_CENTS, MIN_AMOUNT_CENTS } from "./constants";

/** Parse a plain decimal. One dot or one comma. No thousands separators. */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function parseCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const [whole, frac = ""] = normalized.split(".");
  if (whole.length > 9) return null;
  const frac2 = (frac + "00").slice(0, 2);
  const roundUp = frac.length > 2 && frac[2] >= "5";
  let cents = Number(whole) * 100 + Number(frac2);
  if (roundUp) cents += 1;
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}

export function amountCentsInRange(cents: number): boolean {
  return cents >= MIN_AMOUNT_CENTS && cents <= MAX_AMOUNT_CENTS;
}

export function localDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(year, month - 1, date);
  value.setDate(value.getDate() + delta);
  return localDay(value);
}
