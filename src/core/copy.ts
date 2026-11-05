import {
  FREE_DAILY_CSV_ROWS,
  FREE_DAILY_REPRICE_ITEMS,
  WARDROBE_MAX_PAGES,
  WARDROBE_PAGE_SIZE,
} from "./constants";

export const PASSWORD_NOTE =
  "Your password stays on Vinted's site. This extension never asks for it.";

export const NO_TAB_HEADLINE = "Open Vinted first";
export const NO_TAB_DETAIL =
  `Open the Vinted site you sell on and sign in there. Then open this popup again. ${PASSWORD_NOTE}`;

export const SIGNED_OUT_HEADLINE = "Sign in on Vinted";
export const SIGNED_OUT_DETAIL =
  `This Vinted tab is not signed in. Sign in on that tab, then refresh. ${PASSWORD_NOTE}`;

export const LOADING_HEADLINE = "Loading wardrobe";
export const LOADING_DETAIL = "Reading listings from the Vinted tab you already have open.";

export const READY_HEADLINE = "Wardrobe";
export const EMPTY_LIST = "No listings in this wardrobe.";

export const CHECKOUT_NOTE = "Card checkout is not in this version.";
export const UNLOCK_HINT = "Enter the local unlock code to lift limits on this browser.";

export function repriceCapReached(): string {
  return `Daily free limit reached for bulk reprice (${FREE_DAILY_REPRICE_ITEMS} items a day). ${UNLOCK_HINT} ${CHECKOUT_NOTE}`;
}

export function csvCapReached(): string {
  return `Daily free limit reached for CSV export (${FREE_DAILY_CSV_ROWS} rows a day). ${UNLOCK_HINT} ${CHECKOUT_NOTE}`;
}

export function bothCapsReached(): string {
  return `Daily free limits reached: bulk reprice is ${FREE_DAILY_REPRICE_ITEMS} items a day and CSV export is ${FREE_DAILY_CSV_ROWS} rows a day. ${UNLOCK_HINT} ${CHECKOUT_NOTE}`;
}

export function repriceWouldExceed(requested: number, remaining: number): string {
  return `This reprice changes ${requested} listings, and ${remaining} are left today on the free plan (${FREE_DAILY_REPRICE_ITEMS} a day). Select fewer, or enter the local unlock code. ${CHECKOUT_NOTE}`;
}

export function csvWouldExceed(requested: number, remaining: number): string {
  return `This export has ${requested} rows, and ${remaining} CSV rows are left today on the free plan (${FREE_DAILY_CSV_ROWS} a day). Export fewer rows, or enter the local unlock code. ${CHECKOUT_NOTE}`;
}

export function bannerFromUsage(input: {
  unlocked: boolean;
  repriceRemaining: number | null;
  csvRemaining: number | null;
}): string | null {
  if (input.unlocked) return null;
  const repriceOut = input.repriceRemaining === 0;
  const csvOut = input.csvRemaining === 0;
  if (repriceOut && csvOut) return bothCapsReached();
  if (repriceOut) return repriceCapReached();
  if (csvOut) return csvCapReached();
  return null;
}

export function truncationNote(): string {
  const maxRows = WARDROBE_MAX_PAGES * WARDROBE_PAGE_SIZE;
  return `Stopped after ${WARDROBE_MAX_PAGES} pages (${maxRows} listings). Some listings may be missing. This is a safety stop, not the free-plan cap.`;
}

export function busyNotice(): string {
  return "Another wardrobe action is still running.";
}

export function missingSelection(): string {
  return "Select at least one listing.";
}

export function previewFirst(): string {
  return "Preview the new prices before applying them.";
}

export function nothingToExport(): string {
  return "Nothing to export.";
}

export function loadFirst(): string {
  return "Load the wardrobe first.";
}

export function unexpectedWardrobe(): string {
  return "Vinted returned a wardrobe response without an items list. No listings were filled in.";
}

export function wardrobeHttpError(status: number): string {
  if (status === 401 || status === 403) return SIGNED_OUT_DETAIL;
  return `Vinted did not return the wardrobe (HTTP ${status}). No listings were filled in.`;
}

export function networkError(): string {
  return "Could not reach Vinted from this tab. Nothing was changed.";
}

export function nonJsonError(status: number): string {
  return `Vinted returned a page instead of JSON (HTTP ${status}). Refresh the Vinted tab and sign in again if you need to. Nothing was changed.`;
}

export function accountIdError(): string {
  return "Vinted did not return a numeric account id, so the wardrobe was not requested. No listings were filled in.";
}

export function missingIdSkip(): string {
  return "This row has no item id, so it was left unchanged.";
}

export function notInList(): string {
  return "That listing is not in the loaded wardrobe. Refresh and try again. This listing was left unchanged.";
}

export const NOT_AFFILIATED = "Not affiliated with Vinted. You are responsible for complying with Vinted's terms.";
