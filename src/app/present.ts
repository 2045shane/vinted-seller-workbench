import {
  bannerFromUsage,
  EMPTY_LIST,
  LOADING_DETAIL,
  LOADING_HEADLINE,
  NO_TAB_DETAIL,
  NO_TAB_HEADLINE,
  READY_HEADLINE,
  SIGNED_OUT_DETAIL,
  SIGNED_OUT_HEADLINE,
} from "../core/copy";
import type { UsageMeter, ViewState, WardrobeItem } from "../core/types";

export function loadingView(usage: UsageMeter): ViewState {
  return base(usage, {
    phase: "loading",
    headline: LOADING_HEADLINE,
    detail: LOADING_DETAIL,
    items: [],
  });
}

export function noTabView(usage: UsageMeter): ViewState {
  return base(usage, {
    phase: "no-tab",
    headline: NO_TAB_HEADLINE,
    detail: NO_TAB_DETAIL,
    items: [],
  });
}

export function signedOutView(usage: UsageMeter, host: string | null): ViewState {
  return base(usage, {
    phase: "signed-out",
    headline: SIGNED_OUT_HEADLINE,
    detail: SIGNED_OUT_DETAIL,
    host,
    items: [],
  });
}

export function errorView(usage: UsageMeter, host: string | null, detail: string): ViewState {
  return base(usage, {
    phase: "error",
    headline: "Couldn't load the wardrobe",
    detail,
    host,
    items: [],
  });
}

export function readyView(input: {
  usage: UsageMeter;
  items: WardrobeItem[];
  host: string | null;
  accountLabel: string | null;
  truncatedNote: string | null;
  banner?: string | null;
}): ViewState {
  return base(input.usage, {
    phase: "ready",
    headline: READY_HEADLINE,
    detail: input.items.length === 0 ? EMPTY_LIST : `${input.items.length} listings.`,
    host: input.host,
    accountLabel: input.accountLabel,
    items: input.items,
    truncatedNote: input.truncatedNote,
    ...(input.banner !== undefined ? { banner: input.banner } : {}),
  });
}

function base(
  usage: UsageMeter,
  overrides: Partial<ViewState> & Pick<ViewState, "phase" | "headline" | "detail" | "items">,
): ViewState {
  const banner = overrides.banner === undefined ? bannerFromUsage({
    unlocked: usage.unlocked,
    repriceRemaining: usage.repriceLimit == null ? null : Math.max(0, usage.repriceLimit - usage.repriceUsed),
    csvRemaining: usage.csvLimit == null ? null : Math.max(0, usage.csvLimit - usage.csvUsed),
  }) : overrides.banner;
  return {
    phase: overrides.phase,
    headline: overrides.headline,
    detail: overrides.detail,
    host: overrides.host ?? null,
    accountLabel: overrides.accountLabel ?? null,
    items: overrides.items,
    usage,
    banner,
    truncatedNote: overrides.truncatedNote ?? null,
  };
}
