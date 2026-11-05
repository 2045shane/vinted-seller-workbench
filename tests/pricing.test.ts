import { describe, expect, it } from "vitest";
import { parseCents } from "../src/core/money";
import { parseAdjustment, quotePrice } from "../src/core/pricing";

describe("pricing", () => {
  it("rounds extra decimals half up", () => {
    expect(parseCents("1.005")).toBe(101);
    expect(parseCents("1.004")).toBe(100);
    expect(parseCents("10,50")).toBe(1050);
  });

  it("applies a percent to the old price", () => {
    const down = parseAdjustment({ mode: "percent", percent: "-10", fixedOp: "subtract", amount: "" });
    const up = parseAdjustment({ mode: "percent", percent: "10", fixedOp: "subtract", amount: "" });
    expect(down.ok && quotePrice("20.00", down.adjustment)).toEqual({ ok: true, oldPrice: "20.00", newPrice: "18.00" });
    expect(up.ok && quotePrice("20.00", up.adjustment)).toEqual({ ok: true, oldPrice: "20.00", newPrice: "22.00" });
    expect(down.ok && quotePrice("42.00", down.adjustment)).toEqual({ ok: true, oldPrice: "42.00", newPrice: "37.80" });
  });

  it("adds, subtracts, or sets a fixed amount", () => {
    const add = parseAdjustment({ mode: "fixed", percent: "", fixedOp: "add", amount: "1.50" });
    const sub = parseAdjustment({ mode: "fixed", percent: "", fixedOp: "subtract", amount: "1" });
    const set = parseAdjustment({ mode: "fixed", percent: "", fixedOp: "set", amount: "15" });
    expect(add.ok && quotePrice("20.00", add.adjustment)).toEqual({ ok: true, oldPrice: "20.00", newPrice: "21.50" });
    expect(sub.ok && quotePrice("42.00", sub.adjustment)).toEqual({ ok: true, oldPrice: "42.00", newPrice: "41.00" });
    expect(set.ok && quotePrice("", set.adjustment)).toEqual({ ok: true, oldPrice: "", newPrice: "15.00" });
  });

  it("does not invent a price when the old amount is missing", () => {
    const down = parseAdjustment({ mode: "percent", percent: "-10", fixedOp: "subtract", amount: "" });
    expect(down.ok && quotePrice("", down.adjustment)).toMatchObject({
      ok: false,
      message: expect.stringContaining("no price"),
    });
  });

  it("rejects a new price that is not positive", () => {
    const sub = parseAdjustment({ mode: "fixed", percent: "", fixedOp: "subtract", amount: "5" });
    expect(sub.ok && quotePrice("5.00", sub.adjustment)).toMatchObject({ ok: false });
    const zero = parseAdjustment({ mode: "percent", percent: "0", fixedOp: "subtract", amount: "" });
    expect(zero).toMatchObject({ ok: false });
  });
});
