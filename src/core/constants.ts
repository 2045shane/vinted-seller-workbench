/**
 * Locked product numbers for cut VINTED-SELLER-CUT-2026-11-05-v1.
 * Shane Decision 2026-11-05. Change them here only.
 */
export const CUT_ID = "VINTED-SELLER-CUT-2026-11-05-v1";

/** Successful bulk-reprice writes per local day on the free stub. */
export const FREE_DAILY_REPRICE_ITEMS = 25;

/** CSV data rows per local day on the free stub. The header row is free. */
export const FREE_DAILY_CSV_ROWS = 100;

/** Wardrobe reads do not spend either daily counter. */
export const WARDROBE_READ_IS_UNLIMITED = true;

/**
 * Local-only unlock stub. This is not a purchase.
 * The popup accepts this exact code (surrounding whitespace ignored) and
 * stores an unlimited flag in chrome.storage.local on this browser.
 */
export const LOCAL_LICENSE_UNLOCK_CODE = "VSW-STUB-UNLIMITED";

/** Posting a listing again on a timer is out of this cut. */
export const AUTO_RELIST_IN_V1 = false;

/** No card-checkout SDK is bundled in this cut. */
export const PAYMENT_SDK_IN_V1 = false;

/**
 * Page size sent to the website's user-items list.
 * Public descriptions of that list accept up to 96 per page.
 */
export const WARDROBE_PAGE_SIZE = 96;

/**
 * Safety stop so a broken pagination token cannot loop forever.
 * This is not a free-plan cap. Wardrobe read stays unlimited below this bound.
 */
export const WARDROBE_MAX_PAGES = 50;

/** Pause between price writes so a batch is not a single burst. */
export const REPRICE_REQUEST_GAP_MS = 500;

/** Input guards, not Vinted's published price rules. */
export const MIN_AMOUNT_CENTS = 1;
export const MAX_AMOUNT_CENTS = 10_000_000;
export const MIN_PERCENT_BP = -9999;
export const MAX_PERCENT_BP = 100_000;

export const USAGE_STORAGE_KEY = "usageByDay";
export const LICENSE_STORAGE_KEY = "localLicense";
export const USAGE_HISTORY_DAYS = 14;

export const TITLE_MAX_CHARS = 2000;
