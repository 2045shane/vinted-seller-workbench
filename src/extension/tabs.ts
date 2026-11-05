import { hostPatterns, originOfVintedUrl } from "../core/hosts";

export type TabCandidate = {
  id?: number;
  url?: string;
  active: boolean;
  lastAccessed?: number;
};

export function pickVintedTab<T extends TabCandidate>(tabs: readonly T[]): T | null {
  const matches = tabs.filter((tab) => tab.id != null && tab.url != null && originOfVintedUrl(tab.url) != null);
  const active = matches.find((tab) => tab.active);
  if (active) return active;
  return [...matches].sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0] ?? null;
}

export async function findVintedTab(): Promise<{ id: number; origin: string } | null> {
  const patterns = hostPatterns();
  const currentWindow = await chrome.tabs.query({ url: patterns, currentWindow: true });
  const anywhere = currentWindow.length > 0 ? currentWindow : await chrome.tabs.query({ url: patterns });
  const picked = pickVintedTab(anywhere);
  if (!picked?.id || !picked.url) return null;
  const origin = originOfVintedUrl(picked.url);
  if (!origin) return null;
  return { id: picked.id, origin };
}
