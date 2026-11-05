import type { RawResponse, VintedPort } from "../src/core/types";

export const FIXTURE_ORIGIN = "https://www.vinted.fr";

const RAW_ITEMS = [
  {
    id: 101,
    title: "Navy wool coat",
    price: { amount: "42.00", currency_code: "EUR" },
    is_closed: false,
    url: "https://www.vinted.fr/items/101",
  },
  {
    id: 102,
    title: "Silk scarf",
    is_reserved: true,
    total_item_price: "20.00",
    status: "Very good",
  },
  {
    id: 103,
    title: "Leather boots",
    price: "18.50",
    currency: "EUR",
    is_reserved: true,
    path: "/items/103-leather-boots",
  },
  {
    id: 104,
    title: "Felt hat",
    price_numeric: "10.00",
    currency: "GBP",
    is_closed: false,
  },
  {
    id: 105,
    title: "",
    price: { amount: "5.00", currency_code: "EUR" },
    total_item_price: "9.00",
    status: "Very good",
    is_closed: false,
  },
];

export type FixturePort = VintedPort & {
  signedOut: boolean;
  failIds: Set<string>;
  calls: { method: string; path: string; body?: unknown }[];
};

export function createFixturePort(): FixturePort {
  const port: FixturePort = {
    signedOut: false,
    failIds: new Set(["104"]),
    calls: [],
    async request(op): Promise<RawResponse> {
      port.calls.push(op);
      if (op.path === "/api/v2/users/current") {
        if (port.signedOut) return { httpStatus: 401, kind: "json", json: { code: 100, message: "Invalid token" } };
        return { httpStatus: 200, kind: "json", json: { user: { id: 555, login: "fixture-seller" } } };
      }
      if (op.path.startsWith("/api/v2/users/555/items")) {
        return { httpStatus: 200, kind: "json", json: { items: RAW_ITEMS, pagination: { total_pages: 1, current_page: 1 } } };
      }
      const upload = /^\/api\/v2\/item_upload\/items\/(\d+)$/.exec(op.path);
      if (!upload) return { httpStatus: 404, kind: "json", json: { message: "Unknown fixture path" } };
      const id = upload[1];
      if (op.method === "GET") {
        const raw = RAW_ITEMS.find((item) => String(item.id) === id);
        return {
          httpStatus: 200,
          kind: "json",
          json: {
            item: {
              id: Number(id),
              title: raw && "title" in raw ? raw.title : "",
              description: "keep me",
              price: priceOf(raw),
            },
          },
        };
      }
      if (port.failIds.has(id)) {
        return { httpStatus: 403, kind: "json", json: { message: "Editing is not allowed for this listing" } };
      }
      return { httpStatus: 200, kind: "json", json: op.body ?? {} };
    },
  };
  return port;
}

function priceOf(raw: (typeof RAW_ITEMS)[number] | undefined): string {
  if (!raw) return "";
  if ("price" in raw && typeof raw.price === "string") return raw.price;
  if ("price" in raw && raw.price && typeof raw.price === "object" && "amount" in raw.price) return String(raw.price.amount);
  if ("price_numeric" in raw && raw.price_numeric) return raw.price_numeric;
  return "";
}
