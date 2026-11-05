import hostList from "./vinted-hosts.json";

/**
 * Assumption (cut unknown U3): these are public Vinted country sites.
 * The list is not a claim that every market was re-checked on this date,
 * and it is not a requirement to add hosts that are not listed.
 */
export const VINTED_REGISTRABLE_DOMAINS: readonly string[] = hostList;

export function hostPatterns(domains: readonly string[] = VINTED_REGISTRABLE_DOMAINS): string[] {
  const patterns: string[] = [];
  for (const domain of domains) {
    patterns.push(`https://${domain}/*`);
    patterns.push(`https://*.${domain}/*`);
  }
  return patterns;
}

export function isVintedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.includes(" ")) return false;
  return VINTED_REGISTRABLE_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

export function isVintedHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && isVintedHostname(url.hostname);
}

export function originOfVintedUrl(value: string): string | null {
  if (!isVintedHttpUrl(value)) return null;
  return new URL(value).origin;
}
