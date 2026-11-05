import {
  MAX_AMOUNT_CENTS,
  MAX_PERCENT_BP,
  MIN_PERCENT_BP,
} from "./constants";
import { amountCentsInRange, formatCents, parseCents } from "./money";
import type { Adjustment, Quote, WardrobeItem } from "./types";

export type AdjustmentInput = {
  mode: "percent" | "fixed";
  percent: string;
  fixedOp: "add" | "subtract" | "set";
  amount: string;
};

export function parseAdjustment(
  input: AdjustmentInput,
): { ok: true; adjustment: Adjustment } | { ok: false; message: string } {
  if (input.mode === "percent") {
    const basisPoints = parseBasisPoints(input.percent);
    if (basisPoints == null) {
      return { ok: false, message: "Enter a percent with at most two decimals, such as -10 or 5.5." };
    }
    if (basisPoints === 0) {
      return { ok: false, message: "Enter a percent other than zero." };
    }
    if (basisPoints < MIN_PERCENT_BP || basisPoints > MAX_PERCENT_BP) {
      return { ok: false, message: "Enter a percent from -99.99 to 1000." };
    }
    return { ok: true, adjustment: { mode: "percent", basisPoints } };
  }

  if (input.fixedOp !== "add" && input.fixedOp !== "subtract" && input.fixedOp !== "set") {
    return { ok: false, message: "Choose add, subtract, or set." };
  }
  const cents = parseCents(input.amount);
  if (cents == null || !amountCentsInRange(cents)) {
    return { ok: false, message: "Enter an amount from 0.01 to 100000.00." };
  }
  return { ok: true, adjustment: { mode: "fixed", op: input.fixedOp, cents } };
}

export function quotePrice(oldPrice: string, adjustment: Adjustment): Quote {
  if (adjustment.mode === "fixed" && adjustment.op === "set") {
    if (!amountCentsInRange(adjustment.cents)) {
      return {
        ok: false,
        message: "The new price is outside 0.01 to 100000.00. This listing was left unchanged.",
      };
    }
    return { ok: true, oldPrice: displayOld(oldPrice), newPrice: formatCents(adjustment.cents) };
  }

  const oldCents = parseCents(oldPrice);
  if (oldCents == null) {
    return { ok: false, message: "This listing has no price, so it was left unchanged." };
  }
  if (oldCents <= 0) {
    return { ok: false, message: "This listing's price is not a positive amount, so it was left unchanged." };
  }

  const next = nextCents(oldCents, adjustment);
  if (next == null) {
    return {
      ok: false,
      message: "The new price could not be calculated. This listing was left unchanged.",
    };
  }
  if (next <= 0 || next > MAX_AMOUNT_CENTS) {
    return {
      ok: false,
      message: `The new price would be ${formatCents(next)}, which is outside 0.01 to 100000.00. This listing was left unchanged.`,
    };
  }
  return { ok: true, oldPrice: formatCents(oldCents), newPrice: formatCents(next) };
}

export function quoteItem(item: Pick<WardrobeItem, "price">, adjustment: Adjustment): Quote {
  return quotePrice(item.price, adjustment);
}

function nextCents(oldCents: number, adjustment: Adjustment): number | null {
  if (adjustment.mode === "percent") {
    const multiplier = 10_000 + adjustment.basisPoints;
    const next = Math.round((oldCents * multiplier) / 10_000);
    return Number.isSafeInteger(next) ? next : null;
  }
  const next = adjustment.op === "add" ? oldCents + adjustment.cents : oldCents - adjustment.cents;
  return Number.isSafeInteger(next) ? next : null;
}

function displayOld(oldPrice: string): string {
  const cents = parseCents(oldPrice);
  return cents == null ? "" : formatCents(cents);
}

function parseBasisPoints(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.startsWith("+")) return null;
  const negative = trimmed.startsWith("-");
  const rest = negative ? trimmed.slice(1).trim() : trimmed;
  if (!rest || rest.startsWith("-") || rest.startsWith("+")) return null;
  if (fracLength(rest) > 2) return null;
  const cents = parseCents(rest);
  if (cents == null) return null;
  return negative ? -cents : cents;
}

function fracLength(value: string): number {
  const normalized = value.replace(",", ".");
  const dot = normalized.indexOf(".");
  return dot === -1 ? 0 : normalized.length - dot - 1;
}
