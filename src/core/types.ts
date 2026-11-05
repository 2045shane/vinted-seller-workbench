export type WardrobeItem = {
  id: string;
  title: string;
  price: string;
  currency: string;
  status: string;
  url: string;
};

export type SellingStatus = "" | "active" | "draft" | "hidden" | "reserved" | "closed";

/** Integer money. Percent is basis points: -1000 means −10.00%. */
export type Adjustment =
  | { mode: "percent"; basisPoints: number }
  | { mode: "fixed"; op: "add" | "subtract" | "set"; cents: number };

export type UsageMeter = {
  unlocked: boolean;
  repriceUsed: number;
  repriceLimit: number | null;
  csvUsed: number;
  csvLimit: number | null;
};

export type ViewPhase = "loading" | "no-tab" | "signed-out" | "error" | "ready";

export type ViewState = {
  phase: ViewPhase;
  headline: string;
  detail: string;
  host: string | null;
  accountLabel: string | null;
  items: WardrobeItem[];
  usage: UsageMeter;
  banner: string | null;
  truncatedNote: string | null;
};

export type ApplySuccess = {
  id: string;
  title: string;
  oldPrice: string;
  newPrice: string;
  currency: string;
};

export type ApplyFailure = {
  id: string;
  title: string;
  message: string;
};

export type Notice =
  | { kind: "info"; text: string }
  | { kind: "error"; text: string }
  | {
      kind: "apply-result";
      updated: ApplySuccess[];
      failed: ApplyFailure[];
    };

export type CsvFile = {
  filename: string;
  text: string;
};

export type ActionResult = {
  view: ViewState;
  notice: Notice | null;
  csv?: CsvFile;
};

export type DayUsage = {
  repriceItems: number;
  csvRows: number;
};

export type UsageMap = Record<string, DayUsage>;

export type RawResponse = {
  httpStatus: number;
  json: unknown | null;
  kind: "json" | "non-json" | "network" | "blocked";
};

export type VintedPort = {
  request(op: { method: "GET" | "PUT"; path: string; body?: unknown }): Promise<RawResponse>;
};

export type Quote =
  | { ok: true; oldPrice: string; newPrice: string }
  | { ok: false; message: string };
