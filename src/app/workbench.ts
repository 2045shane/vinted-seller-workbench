import { checkCsv, checkReprice, meterFor } from "../core/caps";
import { buildCsv, csvFilename } from "../core/csv";
import {
  accountIdError,
  busyNotice,
  loadFirst,
  missingIdSkip,
  missingSelection,
  networkError,
  nothingToExport,
  notInList,
  truncationNote,
  unexpectedWardrobe,
  wardrobeHttpError,
} from "../core/copy";
import { unlockMatches } from "../core/license";
import type { LicenseStore } from "../core/license";
import { localDay } from "../core/money";
import { quoteItem } from "../core/pricing";
import type { UsageStore } from "../core/usage-store";
import { isVintedHttpUrl } from "../core/hosts";
import { REPRICE_REQUEST_GAP_MS, WARDROBE_MAX_PAGES, WARDROBE_PAGE_SIZE } from "../core/constants";
import type {
  ActionResult,
  Adjustment,
  ApplyFailure,
  ApplySuccess,
  UsageMeter,
  VintedPort,
  WardrobeItem,
} from "../core/types";
import { mergePriceIntoDraft } from "../vinted/edit-price";
import { httpFailure, jsonIndicatesFailure, transportFailure, unchanged, cleanUpstreamMessage } from "../vinted/messages";
import { parseWardrobeItems, readCurrentUser, readWardrobePage } from "../vinted/parse-wardrobe";
import { currentUserPath, itemUploadPath, userItemsPath } from "../vinted/paths";
import { errorView, loadingView, readyView, signedOutView } from "./present";

export type WorkbenchDeps = {
  usage: UsageStore;
  license: LicenseStore;
  now: () => Date;
  sleep?: (ms: number) => Promise<void>;
};

export function createWorkbench(deps: WorkbenchDeps) {
  let inFlight = false;
  const sleep = deps.sleep ?? defaultSleep;

  async function gate(view: ActionResult["view"], run: () => Promise<ActionResult>): Promise<ActionResult> {
    if (inFlight) {
      return { view, notice: { kind: "error", text: busyNotice() } };
    }
    inFlight = true;
    try {
      return await run();
    } finally {
      inFlight = false;
    }
  }

  return {
    async refresh(port: VintedPort, origin: string): Promise<ActionResult> {
      const meter = await currentMeter(deps);
      const host = hostname(origin);
      return gate(loadingView(meter), async () => {
        const loaded = await loadWardrobe(port, origin);
        const nextMeter = await currentMeter(deps);
        if (!loaded.ok) {
          if (loaded.signedOut) return { view: signedOutView(nextMeter, host), notice: null };
          return { view: errorView(nextMeter, host, loaded.message), notice: { kind: "error", text: loaded.message } };
        }
        const accountLabel = loaded.login ? `Signed in as ${loaded.login}` : "Signed in";
        return {
          view: readyView({
            usage: nextMeter,
            items: loaded.items,
            host,
            accountLabel,
            truncatedNote: loaded.truncated ? truncationNote() : null,
          }),
          notice: null,
        };
      });
    },

    async apply(
      port: VintedPort,
      origin: string,
      items: readonly WardrobeItem[],
      itemIds: readonly string[],
      adjustment: Adjustment,
    ): Promise<ActionResult> {
      const meter = await currentMeter(deps);
      const host = hostname(origin);
      const placeholder = readyView({
        usage: meter,
        items: [...items],
        host,
        accountLabel: null,
        truncatedNote: null,
      });
      return gate(placeholder, async () => {
        if (itemIds.length === 0) {
          return { view: placeholder, notice: { kind: "error", text: missingSelection() } };
        }
        const planned = planApply(items, itemIds, adjustment);
        const usage = await deps.usage.read(localDay(deps.now()));
        const unlocked = await deps.license.isUnlocked();
        const cap = checkReprice(usage, planned.writable, unlocked);
        const freshMeter = meterFor(usage, unlocked);
        if (!cap.ok) {
          return {
            view: readyView({
              usage: freshMeter,
              items: [...items],
              host,
              accountLabel: null,
              truncatedNote: null,
              banner: cap.message,
            }),
            notice: { kind: "error", text: cap.message },
          };
        }

        const failures: ApplyFailure[] = [...planned.earlyFailures];
        const updated: ApplySuccess[] = [];
        const nextItems = items.map((item) => ({ ...item }));
        let calledNetwork = false;
        for (const job of planned.jobs) {
          if (calledNetwork) await sleep(REPRICE_REQUEST_GAP_MS);
          calledNetwork = true;
          let written: { ok: true } | { ok: false; message: string };
          try {
            written = await writePrice(port, job.item.id, job.newPrice);
          } catch (error) {
            written = {
              ok: false,
              message: unchangedError(error),
            };
          }
          if (!written.ok) {
            failures.push({ id: job.item.id, title: job.item.title, message: written.message });
            continue;
          }
          updated.push({
            id: job.item.id,
            title: job.item.title,
            oldPrice: job.oldPrice,
            newPrice: job.newPrice,
            currency: job.item.currency,
          });
          const row = nextItems.find((item) => item.id === job.item.id);
          if (row) row.price = job.newPrice;
        }
        if (updated.length > 0) await deps.usage.add(localDay(deps.now()), { repriceItems: updated.length });
        const after = meterFor(await deps.usage.read(localDay(deps.now())), await deps.license.isUnlocked());
        return {
          view: readyView({
            usage: after,
            items: nextItems,
            host,
            accountLabel: null,
            truncatedNote: null,
          }),
          notice: { kind: "apply-result", updated, failed: failures },
        };
      });
    },

    async exportCsv(items: readonly WardrobeItem[], itemIds: readonly string[] | null): Promise<ActionResult> {
      const meter = await currentMeter(deps);
      const placeholder = readyView({
        usage: meter,
        items: [...items],
        host: null,
        accountLabel: null,
        truncatedNote: null,
      });
      return gate(placeholder, async () => {
        const rows = pickRows(items, itemIds);
        if (rows.length === 0) {
          return { view: placeholder, notice: { kind: "error", text: items.length === 0 ? loadFirst() : nothingToExport() } };
        }
        const today = localDay(deps.now());
        const usage = await deps.usage.read(today);
        const unlocked = await deps.license.isUnlocked();
        const cap = checkCsv(usage, rows.length, unlocked);
        if (!cap.ok) {
          const fresh = meterFor(usage, unlocked);
          return {
            view: readyView({
              usage: fresh,
              items: [...items],
              host: null,
              accountLabel: null,
              truncatedNote: null,
              banner: cap.message,
            }),
            notice: { kind: "error", text: cap.message },
          };
        }
        const text = buildCsv(rows, deps.now().toISOString());
        await deps.usage.add(today, { csvRows: rows.length });
        const after = meterFor(await deps.usage.read(today), await deps.license.isUnlocked());
        return {
          view: readyView({
            usage: after,
            items: [...items],
            host: null,
            accountLabel: null,
            truncatedNote: null,
          }),
          notice: { kind: "info", text: `Exported ${rows.length} rows.` },
          csv: { filename: csvFilename(today), text },
        };
      });
    },

    async unlock(items: readonly WardrobeItem[], code: string): Promise<ActionResult> {
      return changeLicense(items, async () => {
        if (!unlockMatches(code)) {
          return "That code does not match the local unlock stub.";
        }
        await deps.license.setUnlocked(true);
        return null;
      }, "Local unlock saved on this browser. Daily free caps are lifted until you remove it.");
    },

    async lock(items: readonly WardrobeItem[]): Promise<ActionResult> {
      return changeLicense(items, async () => {
        await deps.license.setUnlocked(false);
        return null;
      }, "Local unlock removed. Daily free caps apply again.");
    },

    async meter(): Promise<UsageMeter> {
      return currentMeter(deps);
    },
  };

  async function changeLicense(
    items: readonly WardrobeItem[],
    mutate: () => Promise<string | null>,
    success: string,
  ): Promise<ActionResult> {
    const meter = await currentMeter(deps);
    const placeholder = readyView({
      usage: meter,
      items: [...items],
      host: null,
      accountLabel: null,
      truncatedNote: null,
    });
    return gate(placeholder, async () => {
      const error = await mutate();
      const after = await currentMeter(deps);
      const view = readyView({
        usage: after,
        items: [...items],
        host: null,
        accountLabel: null,
        truncatedNote: null,
      });
      if (error) return { view, notice: { kind: "error", text: error } };
      return { view, notice: { kind: "info", text: success } };
    });
  }
}

function planApply(items: readonly WardrobeItem[], itemIds: readonly string[], adjustment: Adjustment): {
  jobs: { item: WardrobeItem; oldPrice: string; newPrice: string }[];
  earlyFailures: ApplyFailure[];
  writable: number;
} {
  const byId = new Map(items.filter((item) => item.id).map((item) => [item.id, item]));
  const jobs: { item: WardrobeItem; oldPrice: string; newPrice: string }[] = [];
  const earlyFailures: ApplyFailure[] = [];
  const seen = new Set<string>();
  for (const id of itemIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = byId.get(id);
    if (!item) {
      earlyFailures.push({ id, title: "", message: notInList() });
      continue;
    }
    if (!item.id) {
      earlyFailures.push({ id, title: item.title, message: missingIdSkip() });
      continue;
    }
    const quote = quoteItem(item, adjustment);
    if (!quote.ok) {
      earlyFailures.push({ id: item.id, title: item.title, message: quote.message });
      continue;
    }
    jobs.push({ item, oldPrice: quote.oldPrice, newPrice: quote.newPrice });
  }
  return { jobs, earlyFailures, writable: jobs.length };
}

function pickRows(items: readonly WardrobeItem[], itemIds: readonly string[] | null): WardrobeItem[] {
  if (itemIds == null) return [...items];
  const wanted = new Set(itemIds);
  return items.filter((item) => item.id !== "" && wanted.has(item.id));
}

async function loadWardrobe(port: VintedPort, origin: string): Promise<
  | { ok: true; items: WardrobeItem[]; login: string; truncated: boolean }
  | { ok: false; signedOut: boolean; message: string }
> {
  if (!isVintedHttpUrl(origin)) {
    return { ok: false, signedOut: false, message: "This tab is not a Vinted site, so the wardrobe was not requested." };
  }
  const current = await port.request({ method: "GET", path: currentUserPath() });
  if (current.kind === "network" || current.kind === "blocked") {
    return { ok: false, signedOut: false, message: networkError() };
  }
  if (current.httpStatus === 401 || current.httpStatus === 403) {
    return { ok: false, signedOut: true, message: wardrobeHttpError(current.httpStatus) };
  }
  if (current.kind !== "json" || current.httpStatus < 200 || current.httpStatus >= 300) {
    return {
      ok: false,
      signedOut: false,
      message: current.kind === "json" ? wardrobeHttpError(current.httpStatus) : transportFailure("non-json", current.httpStatus),
    };
  }
  const user = readCurrentUser(current.json);
  if (!user.ok) return { ok: false, signedOut: false, message: accountIdError() };

  const raw: unknown[] = [];
  let truncated = false;
  const seenPageIds = new Set<string>();
  for (let page = 1; page <= WARDROBE_MAX_PAGES; page += 1) {
    const path = userItemsPath(user.id, page);
    if (!path) return { ok: false, signedOut: false, message: accountIdError() };
    const response = await port.request({ method: "GET", path });
    if (response.kind !== "json") {
      return { ok: false, signedOut: false, message: transportFailure(response.kind === "blocked" ? "blocked" : response.kind, response.httpStatus) };
    }
    if (response.httpStatus === 401 || response.httpStatus === 403) {
      return { ok: false, signedOut: true, message: wardrobeHttpError(response.httpStatus) };
    }
    if (response.httpStatus < 200 || response.httpStatus >= 300) {
      return { ok: false, signedOut: false, message: wardrobeHttpError(response.httpStatus) };
    }
    const parsed = readWardrobePage(response.json);
    if (!parsed.ok) return { ok: false, signedOut: false, message: unexpectedWardrobe() };
    const pageIds = parsed.items
      .map((item) => (item && typeof item === "object" ? String((item as { id?: unknown }).id ?? "") : ""))
      .filter((id) => id !== "");
    if (pageIds.length > 0 && pageIds.every((id) => seenPageIds.has(id))) break;
    pageIds.forEach((id) => seenPageIds.add(id));
    raw.push(...parsed.items);
    if (parsed.totalPages != null && page >= parsed.totalPages) break;
    if (parsed.totalPages == null && parsed.items.length < WARDROBE_PAGE_SIZE) break;
    if (page === WARDROBE_MAX_PAGES) truncated = true;
  }
  return { ok: true, items: parseWardrobeItems(raw, origin), login: user.login, truncated };
}

async function writePrice(
  port: VintedPort,
  itemId: string,
  newPrice: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const path = itemUploadPath(itemId);
  if (!path) return { ok: false, message: missingIdSkip() };
  const got = await port.request({ method: "GET", path });
  const loaded = readDraftResponse(got);
  if (!loaded.ok) return loaded;
  const merged = mergePriceIntoDraft(loaded.json, newPrice);
  if (!merged.ok) return merged;
  const put = await port.request({ method: "PUT", path, body: merged.body });
  return readWriteResponse(put);
}

function readDraftResponse(response: Awaited<ReturnType<VintedPort["request"]>>): { ok: true; json: unknown } | { ok: false; message: string } {
  if (response.kind !== "json") {
    return { ok: false, message: unchanged(transportFailure(response.kind === "non-json" ? "non-json" : "network", response.httpStatus)) };
  }
  if (response.httpStatus < 200 || response.httpStatus >= 300) {
    const fallback = `Vinted did not return this listing for editing (HTTP ${response.httpStatus}).`;
    return { ok: false, message: httpFailure(response.httpStatus, response.json, unchanged(fallback)) };
  }
  const failure = jsonIndicatesFailure(response.json);
  if (failure) {
    return { ok: false, message: unchanged(cleanUpstreamMessage(failure, "Vinted did not return this listing for editing.")) };
  }
  return { ok: true, json: response.json };
}

function readWriteResponse(response: Awaited<ReturnType<VintedPort["request"]>>): { ok: true } | { ok: false; message: string } {
  if (response.kind === "network" || response.kind === "blocked") {
    return { ok: false, message: unchanged(networkError()) };
  }
  if (response.httpStatus >= 200 && response.httpStatus < 300 && response.kind === "non-json") {
    return { ok: true };
  }
  if (response.kind !== "json") {
    return { ok: false, message: unchanged(transportFailure("non-json", response.httpStatus)) };
  }
  if (response.httpStatus < 200 || response.httpStatus >= 300) {
    const fallback = `Vinted refused this request (HTTP ${response.httpStatus}).`;
    return { ok: false, message: httpFailure(response.httpStatus, response.json, unchanged(fallback)) };
  }
  const failure = jsonIndicatesFailure(response.json);
  if (failure) {
    return { ok: false, message: unchanged(cleanUpstreamMessage(failure, "Vinted rejected the edit.")) };
  }
  return { ok: true };
}

function hostname(origin: string): string | null {
  if (!isVintedHttpUrl(origin)) return null;
  return new URL(origin).hostname;
}

async function currentMeter(deps: WorkbenchDeps): Promise<UsageMeter> {
  const usage = await deps.usage.read(localDay(deps.now()));
  const unlocked = await deps.license.isUnlocked();
  return meterFor(usage, unlocked);
}

function unchangedError(error: unknown): string {
  const detail = error instanceof Error ? error.message : "The request failed.";
  const clean = detail.replace(/\s+/g, " ").slice(0, 160);
  if (/cookie|csrf|token|password|authorization/i.test(clean)) {
    return "The request failed. The price was not changed.";
  }
  return `${clean} The price was not changed.`;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
