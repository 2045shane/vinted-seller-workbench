export function buildManifest(): {
  manifest_version: number;
  name: string;
  description: string;
  permissions: string[];
  host_permissions: string[];
  content_scripts: { matches: string[]; js: string[] }[];
};

export function hostPatterns(domains?: readonly string[]): string[];
export function readDomains(): string[];
