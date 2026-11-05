import { describe, expect, it } from "vitest";
import { mergePriceIntoDraft } from "../src/vinted/edit-price";
import { parseWardrobeItems, readCurrentUser } from "../src/vinted/parse-wardrobe";

const origin = "https://www.vinted.fr";

describe("wardrobe parsing", () => {
  it("reads title, price, selling status, and url without inventing a price", () => {
    const [coat, scarf, boots, hat, blank] = parseWardrobeItems([
      {
        id: 101,
        title: "Navy wool coat",
        price: { amount: "42.00", currency_code: "EUR" },
        is_closed: false,
        url: "https://www.vinted.fr/items/101#photo",
      },
      { id: 102, title: "Silk scarf", is_reserved: true, total_item_price: "20.00", service_fee: "3.00", status: "Very good" },
      { id: 103, title: "Leather boots", price: "18.50", currency: "EUR", is_reserved: true, path: "/items/103-leather-boots" },
      { id: 104, title: "Felt hat", price_numeric: "10.00", currency: "GBP", is_closed: false },
      { id: 105, title: "", price: { amount: "5.00", currency_code: "EUR" }, total_item_price: "9.00", status: "Very good", is_closed: false },
      { id: 101, title: "duplicate" },
      { note: "no fields" },
    ], origin);

    expect(coat).toMatchObject({ id: "101", title: "Navy wool coat", price: "42.00", currency: "EUR", status: "active", url: "https://www.vinted.fr/items/101" });
    expect(scarf).toMatchObject({ id: "102", price: "", currency: "", status: "reserved", url: "https://www.vinted.fr/items/102" });
    expect(scarf?.title).toBe("Silk scarf");
    expect(boots).toMatchObject({ price: "18.50", currency: "EUR", status: "reserved", url: "https://www.vinted.fr/items/103-leather-boots" });
    expect(hat).toMatchObject({ price: "10.00", currency: "GBP", status: "active" });
    expect(blank).toMatchObject({ id: "105", title: "", price: "5.00", currency: "EUR", status: "active" });
    expect(parseWardrobeItems([{ id: 101 }, { id: 101 }], origin)).toHaveLength(1);
  });

  it("drops a non-vinted url instead of keeping it", () => {
    const [item] = parseWardrobeItems([{ id: 9, title: "Pin", price: "1.00", url: "https://evil.example/track" }], origin);
    expect(item?.url).toBe("https://www.vinted.fr/items/9");
  });

  it("reads the signed-in account id and ignores a missing one", () => {
    expect(readCurrentUser({ user: { id: 555, login: "ada" } })).toEqual({ ok: true, id: "555", login: "ada" });
    expect(readCurrentUser({ user: { login: "ada" } })).toEqual({ ok: false });
    expect(readCurrentUser({ code: 100 })).toEqual({ ok: false });
  });
});

describe("price edits", () => {
  it("changes only the price on the draft Vinted returned", () => {
    const merged = mergePriceIntoDraft({
      item: { id: 5, title: "Coat", description: "wool", price: "42.00" },
    }, "37.80");
    expect(merged).toEqual({
      ok: true,
      body: { item: { id: 5, title: "Coat", description: "wool", price: "37.80" } },
    });
  });

  it("updates an amount object without dropping the currency", () => {
    const merged = mergePriceIntoDraft({
      item: { id: 5, price: { amount: "42.00", currency_code: "EUR" }, price_numeric: "42.00" },
    }, "37.80");
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      expect(merged.body.item.price).toEqual({ amount: "37.80", currency_code: "EUR" });
      expect(merged.body.item.price_numeric).toBe("37.80");
    }
  });

  it("refuses to send an edit when the draft has no item id", () => {
    expect(mergePriceIntoDraft({ item: { title: "Coat" } }, "10.00").ok).toBe(false);
  });
});
