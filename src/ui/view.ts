import { readyView } from "../app/present";
import { CUT_ID, FREE_DAILY_CSV_ROWS, FREE_DAILY_REPRICE_ITEMS } from "../core/constants";
import {
  CHECKOUT_NOTE,
  NOT_AFFILIATED,
  PASSWORD_NOTE,
  busyNotice,
  missingSelection,
  previewFirst,
} from "../core/copy";
import { parseAdjustment, quoteItem, type AdjustmentInput } from "../core/pricing";
import type {
  ActionResult,
  Adjustment,
  Notice,
  ViewState,
  WardrobeItem,
} from "../core/types";
import { downloadCsv } from "./download";

export type WorkbenchClient = {
  refresh(): Promise<ActionResult>;
  apply(items: WardrobeItem[], itemIds: string[], adjustment: Adjustment): Promise<ActionResult>;
  exportCsv(items: WardrobeItem[], itemIds: string[] | null): Promise<ActionResult>;
  unlock(items: WardrobeItem[], code: string): Promise<ActionResult>;
  lock(items: WardrobeItem[]): Promise<ActionResult>;
};

type FormState = AdjustmentInput;

type ArmedPreview = {
  key: string;
  adjustment: Adjustment;
  ids: string[];
};

const EMPTY_METER = {
  unlocked: false,
  repriceUsed: 0,
  repriceLimit: FREE_DAILY_REPRICE_ITEMS,
  csvUsed: 0,
  csvLimit: FREE_DAILY_CSV_ROWS,
};

export function mount(root: HTMLElement, client: WorkbenchClient): void {
  let view: ViewState = readyView({
    usage: EMPTY_METER,
    items: [],
    host: null,
    accountLabel: null,
    truncatedNote: null,
  });
  view = { ...view, phase: "loading", headline: "Loading wardrobe", detail: "Reading listings from the Vinted tab you already have open." };
  let selected = new Set<string>();
  let form: FormState = { mode: "percent", percent: "", fixedOp: "subtract", amount: "" };
  let armed: ArmedPreview | null = null;
  let notice: Notice | null = null;
  let busy = false;

  const paint = () => {
    root.replaceChildren(renderWorkbench(view, notice, form, selected, armed, busy));
    bind();
  };

  const bind = () => {
    root.querySelector<HTMLButtonElement>('[data-action="refresh"]')?.addEventListener("click", () => void runRefresh());
    root.querySelector<HTMLButtonElement>('[data-action="export"]')?.addEventListener("click", () => void runExport());
    root.querySelector<HTMLButtonElement>('[data-action="apply"]')?.addEventListener("click", () => void runApply());
    root.querySelector<HTMLButtonElement>('[data-action="unlock"]')?.addEventListener("click", () => void runUnlock());
    root.querySelector<HTMLButtonElement>('[data-action="lock"]')?.addEventListener("click", () => void runLock());
    root.querySelector<HTMLInputElement>('[data-action="select-all"]')?.addEventListener("change", (event) => {
      const checked = (event.target as HTMLInputElement).checked;
      selected = new Set(checked ? view.items.filter((item) => item.id).map((item) => item.id) : []);
      armed = null;
      captureForm();
      paint();
    });
    for (const box of root.querySelectorAll<HTMLInputElement>("[data-item-id]")) {
      box.addEventListener("change", () => {
        const id = box.dataset.itemId ?? "";
        if (box.checked) selected.add(id);
        else selected.delete(id);
        armed = null;
        captureForm();
        paint();
      });
    }
    root.querySelector<HTMLFormElement>("[data-reprice]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      showPreview();
    });
    const formEl = root.querySelector<HTMLFormElement>("[data-reprice]");
    const clearArmed = () => {
      armed = null;
      const apply = root.querySelector<HTMLButtonElement>('[data-action="apply"]');
      if (apply) apply.disabled = true;
      root.querySelector('[data-testid="preview"]')?.replaceChildren();
    };
    formEl?.addEventListener("input", clearArmed);
    formEl?.addEventListener("change", clearArmed);
  };

  const captureForm = () => {
    const mode = root.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value;
    const percent = root.querySelector<HTMLInputElement>('[data-field="percent"]')?.value ?? form.percent;
    const amount = root.querySelector<HTMLInputElement>('[data-field="amount"]')?.value ?? form.amount;
    const fixedOp = root.querySelector<HTMLSelectElement>('[data-field="fixed-op"]')?.value ?? form.fixedOp;
    form = {
      mode: mode === "fixed" ? "fixed" : "percent",
      percent,
      amount,
      fixedOp: fixedOp === "add" || fixedOp === "set" ? fixedOp : "subtract",
    };
  };

  const showPreview = () => {
    captureForm();
    const ids = orderedSelection();
    if (ids.length === 0) {
      notice = { kind: "error", text: missingSelection() };
      armed = null;
      paint();
      return;
    }
    const parsed = parseAdjustment(form);
    if (!parsed.ok) {
      notice = { kind: "error", text: parsed.message };
      armed = null;
      paint();
      return;
    }
    armed = { key: previewKey(ids, form), adjustment: parsed.adjustment, ids };
    notice = null;
    paint();
  };

  const orderedSelection = (): string[] => view.items.filter((item) => item.id && selected.has(item.id)).map((item) => item.id);

  async function runRefresh() {
    await run(async () => {
      const result = await client.refresh();
      view = result.view;
      selected = new Set([...selected].filter((id) => view.items.some((item) => item.id === id)));
      return result;
    }, true);
  }

  async function runApply() {
    captureForm();
    if (!armed || armed.key !== previewKey(orderedSelection(), form)) {
      notice = { kind: "error", text: previewFirst() };
      armed = null;
      paint();
      return;
    }
    const adjustment = armed.adjustment;
    const ids = [...armed.ids];
    await run(async () => {
      const result = await client.apply(view.items, ids, adjustment);
      view = keepSession(view, result.view);
      return result;
    });
  }

  async function runExport() {
    const ids = orderedSelection();
    await run(async () => {
      const result = await client.exportCsv(view.items, ids.length ? ids : null);
      view = keepSession(view, result.view);
      return result;
    });
  }

  async function runUnlock() {
    const code = root.querySelector<HTMLInputElement>('[data-field="unlock"]')?.value ?? "";
    await run(async () => {
      const result = await client.unlock(view.items, code);
      view = keepSession(view, result.view);
      return result;
    });
  }

  async function runLock() {
    await run(async () => {
      const result = await client.lock(view.items);
      view = keepSession(view, result.view);
      return result;
    });
  }

  async function run(action: () => Promise<ActionResult>, replaceView = false) {
    if (busy) {
      notice = { kind: "error", text: busyNotice() };
      paint();
      return;
    }
    busy = true;
    captureForm();
    paint();
    try {
      const result = await action();
      if (!replaceView) view = keepSession(view, result.view);
      if (result.notice && result.notice.kind !== "apply-result" && result.notice.text === busyNotice() && !replaceView) {
        notice = result.notice;
      } else {
        notice = dedupeNotice(result.view.banner, result.notice);
        if (result.csv) downloadCsv(result.csv);
      }
      armed = null;
    } catch (error) {
      notice = { kind: "error", text: error instanceof Error ? error.message : "Something went wrong. Nothing was changed." };
    } finally {
      busy = false;
      paint();
    }
  }

  paint();
  void runRefresh();
}

export function keepSession(previous: ViewState, next: ViewState): ViewState {
  if (next.phase !== "ready" || previous.phase !== "ready") return next;
  return {
    ...next,
    host: next.host ?? previous.host,
    accountLabel: next.accountLabel ?? previous.accountLabel,
    truncatedNote: next.truncatedNote ?? previous.truncatedNote,
  };
}

function dedupeNotice(banner: string | null, notice: Notice | null): Notice | null {
  if (!notice || notice.kind === "apply-result") return notice;
  if (banner && notice.text === banner) return null;
  return notice;
}

function previewKey(ids: string[], form: FormState): string {
  return JSON.stringify({ ids, form });
}

function renderWorkbench(
  view: ViewState,
  notice: Notice | null,
  form: FormState,
  selected: Set<string>,
  armed: ArmedPreview | null,
  busy: boolean,
): HTMLElement {
  const shell = el("div", "workbench");
  shell.append(renderMasthead(view), renderBanner(view), renderTruncation(view));
  const toolbar = el("div", "toolbar");
  toolbar.append(
    button("Refresh", "refresh", busy),
    button("Export CSV", "export", busy || view.phase !== "ready"),
  );
  shell.append(toolbar);
  shell.append(renderList(view, selected, busy));
  shell.append(renderReprice(view, form, selected, armed, busy));
  shell.append(renderNotice(notice));
  shell.append(renderLicense(view, busy));
  shell.append(renderFooter());
  return shell;
}

function renderMasthead(view: ViewState): HTMLElement {
  const header = el("header", "masthead");
  const mark = el("div", "mark");
  mark.textContent = "Wb";
  const text = el("div");
  const title = document.createElement("h1");
  title.textContent = "Vinted Seller Workbench";
  const session = el("p", "session");
  session.dataset.testid = "phase";
  session.dataset.phase = view.phase;
  session.textContent = sessionLine(view);
  const usage = el("p", "usage");
  usage.dataset.testid = "usage";
  usage.textContent = usageLine(view);
  text.append(title, session, usage);
  header.append(mark, text);
  return header;
}

function sessionLine(view: ViewState): string {
  if (view.phase === "no-tab") return view.headline;
  if (view.phase === "signed-out") return view.headline;
  if (view.phase === "loading") return view.headline;
  if (view.phase === "error") return view.headline;
  const who = view.accountLabel ?? "Signed in";
  return view.host ? `${who} · ${view.host}` : who;
}

function usageLine(view: ViewState): string {
  const usage = view.usage;
  if (usage.unlocked) return "Reprice unlimited · CSV unlimited (local unlock)";
  return `Reprice ${usage.repriceUsed}/${usage.repriceLimit} today · CSV ${usage.csvUsed}/${usage.csvLimit} today`;
}

function renderBanner(view: ViewState): HTMLElement {
  const banner = el("div", "banner");
  banner.dataset.testid = "banner";
  banner.setAttribute("role", "status");
  if (!view.banner) {
    banner.hidden = true;
    return banner;
  }
  banner.textContent = view.banner;
  return banner;
}

function renderTruncation(view: ViewState): HTMLElement {
  const note = el("div", "truncation");
  if (!view.truncatedNote) {
    note.hidden = true;
    return note;
  }
  note.textContent = view.truncatedNote;
  return note;
}

function renderList(view: ViewState, selected: Set<string>, busy: boolean): HTMLElement {
  const wrap = el("section");
  const head = el("div", "list-head");
  const selectLabel = document.createElement("label");
  const selectAll = document.createElement("input");
  selectAll.type = "checkbox";
  selectAll.dataset.action = "select-all";
  const selectable = view.items.filter((item) => item.id);
  const selectedCount = selectable.filter((item) => selected.has(item.id)).length;
  selectAll.checked = selectable.length > 0 && selectedCount === selectable.length;
  selectAll.indeterminate = selectedCount > 0 && selectedCount < selectable.length;
  selectAll.disabled = busy || selectable.length === 0;
  selectLabel.append(selectAll, document.createTextNode(` Select all (${selectedCount})`));
  const count = el("span");
  count.textContent = view.phase === "ready" ? `${view.items.length} listed` : "";
  head.append(selectLabel, count);
  const list = document.createElement("ul");
  list.className = "listings";
  if (view.phase !== "ready") {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = view.detail;
    list.append(item);
  } else if (view.items.length === 0) {
    const item = document.createElement("li");
    item.className = "empty";
    item.dataset.testid = "empty";
    item.textContent = view.detail;
    list.append(item);
  } else {
    for (const item of view.items) list.append(renderItem(item, selected.has(item.id), busy));
  }
  wrap.append(head, list);
  return wrap;
}

function renderItem(item: WardrobeItem, checked: boolean, busy: boolean): HTMLElement {
  const row = document.createElement("li");
  row.dataset.testid = "item";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = checked && !!item.id;
  box.disabled = busy || !item.id;
  box.dataset.itemId = item.id;
  const label = document.createElement("label");
  label.style.display = "contents";
  const copy = el("span");
  const title = el("span", "title");
  title.textContent = item.title || "—";
  if (item.title) title.title = item.title;
  const meta = el("span", "meta");
  const price = el("span");
  price.dataset.testid = "price";
  price.textContent = item.price ? (item.currency ? `${item.price} ${item.currency}` : item.price) : "—";
  const status = el("span");
  status.dataset.testid = "status";
  status.textContent = statusLabel(item.status);
  meta.append(price, document.createTextNode(" · "), status);
  copy.append(title, meta);
  label.append(box, copy);
  row.append(label);
  if (item.url) {
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open";
    row.append(link);
  } else {
    row.append(document.createTextNode(""));
  }
  return row;
}

function renderReprice(
  view: ViewState,
  form: FormState,
  selected: Set<string>,
  armed: ArmedPreview | null,
  busy: boolean,
): HTMLElement {
  const section = el("section", "reprice");
  const heading = document.createElement("h2");
  heading.textContent = "Bulk reprice";
  const formEl = document.createElement("form");
  formEl.dataset.reprice = "true";
  const modes = el("div", "modes");
  modes.append(radio("percent", "Percent", form.mode === "percent"), radio("fixed", "Fixed amount", form.mode === "fixed"));
  const percent = el("div", "percent-row");
  percent.append(document.createTextNode("Percent"), textField("percent", form.percent, "−10"));
  const hint = el("p", "hint");
  hint.textContent = "Negative lowers the price. −10 means 10% off. Fixed can add, subtract, or set the price.";
  const fixed = el("div", "fixed-row");
  const op = document.createElement("select");
  op.dataset.field = "fixed-op";
  for (const [value, label] of [["subtract", "Subtract"], ["add", "Add"], ["set", "Set"]] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = form.fixedOp === value;
    op.append(option);
  }
  fixed.append(op, textField("amount", form.amount, "1.00"));
  const actions = el("div", "reprice-actions");
  actions.append(
    button("Preview", "preview", busy || view.phase !== "ready", true),
    button("Apply prices", "apply", busy || view.phase !== "ready" || !armed),
  );
  const preview = document.createElement("div");
  preview.dataset.testid = "preview";
  if (armed) preview.append(renderPreviewTable(view.items, armed, selected));
  formEl.append(modes, percent, fixed, hint, actions, preview);
  section.append(heading, formEl);
  return section;
}

function renderPreviewTable(items: WardrobeItem[], armed: ArmedPreview, selected: Set<string>): HTMLElement {
  const table = document.createElement("table");
  table.className = "preview";
  const head = document.createElement("tr");
  for (const label of ["Listing", "Old", "New"]) {
    const cell = document.createElement("th");
    cell.textContent = label;
    head.append(cell);
  }
  table.append(head);
  for (const id of armed.ids) {
    if (!selected.has(id)) continue;
    const item = items.find((candidate) => candidate.id === id);
    const row = document.createElement("tr");
    const name = document.createElement("td");
    name.textContent = item?.title || id;
    const oldCell = document.createElement("td");
    const newCell = document.createElement("td");
    if (!item) {
      newCell.textContent = "Not in the list";
      newCell.className = "bad";
    } else {
      const quote = quoteItem(item, armed.adjustment);
      if (!quote.ok) {
        oldCell.textContent = item.price || "—";
        newCell.textContent = quote.message;
        newCell.className = "bad";
      } else {
        oldCell.textContent = quote.oldPrice || "—";
        newCell.textContent = quote.newPrice;
      }
    }
    row.append(name, oldCell, newCell);
    table.append(row);
  }
  return table;
}

function renderNotice(notice: Notice | null): HTMLElement {
  const box = el("div", "results");
  box.dataset.testid = "results";
  box.setAttribute("role", "status");
  if (!notice) return box;
  if (notice.kind === "apply-result") {
    const summary = el("p");
    summary.textContent = `Updated ${notice.updated.length}. Failed ${notice.failed.length}.`;
    box.append(summary);
    if (notice.failed.length) {
      const list = document.createElement("ul");
      for (const failure of notice.failed) {
        const item = document.createElement("li");
        item.className = "failure";
        item.textContent = `${failure.id || "—"}${failure.title ? ` ${failure.title}` : ""} — ${failure.message}`;
        list.append(item);
      }
      box.append(list);
    }
    if (notice.updated.length) {
      const details = document.createElement("details");
      const summaryEl = document.createElement("summary");
      summaryEl.textContent = "Show updated prices";
      const list = document.createElement("ul");
      for (const success of notice.updated) {
        const item = document.createElement("li");
        const currency = success.currency ? ` ${success.currency}` : "";
        item.textContent = `${success.title || success.id}: ${success.oldPrice || "—"}${currency} → ${success.newPrice}${currency}`;
        list.append(item);
      }
      details.append(summaryEl, list);
      box.append(details);
    }
    return box;
  }
  const paragraph = el("p", "note");
  paragraph.dataset.kind = notice.kind;
  paragraph.textContent = notice.text;
  box.append(paragraph);
  return box;
}

function renderLicense(view: ViewState, busy: boolean): HTMLElement {
  const section = el("section", "license");
  const heading = document.createElement("h2");
  heading.textContent = "Local unlock";
  section.append(heading);
  if (view.usage.unlocked) {
    const state = el("p");
    state.textContent = "Local unlimited unlock is on for this browser.";
    section.append(state, button("Remove local unlock", "lock", busy, true));
  } else {
    const row = el("div", "license-row");
    const input = document.createElement("input");
    input.type = "text";
    input.dataset.field = "unlock";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Local unlock code");
    row.append(input, button("Unlock", "unlock", busy, true));
    const help = el("p", "hint");
    help.textContent = `The code is a local stub, not a purchase. ${CHECKOUT_NOTE}`;
    section.append(row, help);
  }
  return section;
}

function renderFooter(): HTMLElement {
  const footer = el("footer", "footer");
  const password = el("p");
  password.dataset.testid = "password-note";
  password.textContent = PASSWORD_NOTE;
  const terms = el("p");
  terms.textContent = NOT_AFFILIATED;
  const cut = el("p");
  cut.textContent = CUT_ID;
  footer.append(password, terms, cut);
  return footer;
}

function radio(value: "percent" | "fixed", label: string, checked: boolean): HTMLElement {
  const wrap = document.createElement("label");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "mode";
  input.value = value;
  input.checked = checked;
  wrap.append(input, document.createTextNode(` ${label}`));
  return wrap;
}

function textField(field: string, value: string, placeholder: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.dataset.field = field;
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.setAttribute("aria-label", field === "percent" ? "Percent" : "Amount");
  return input;
}

function button(label: string, action: string, disabled: boolean, secondary = false): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = action === "preview" ? "submit" : "button";
  node.textContent = label;
  node.dataset.action = action;
  node.disabled = disabled;
  if (secondary) node.className = "secondary";
  return node;
}

function statusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "reserved") return "Reserved";
  if (status === "hidden") return "Hidden";
  if (status === "closed") return "Closed";
  if (status === "draft") return "Draft";
  return "—";
}

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}
