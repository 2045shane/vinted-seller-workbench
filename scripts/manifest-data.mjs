import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readDomains() {
  const file = path.join(root, "src/core/vinted-hosts.json");
  const domains = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(domains) || domains.some((domain) => typeof domain !== "string")) {
    throw new Error("vinted-hosts.json must be a list of hostnames");
  }
  return domains;
}

export function hostPatterns(domains = readDomains()) {
  const patterns = [];
  for (const domain of domains) {
    patterns.push(`https://${domain}/*`);
    patterns.push(`https://*.${domain}/*`);
  }
  return patterns;
}

export function buildManifest() {
  const templatePath = path.join(root, "src/extension/manifest.template.json");
  const manifest = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  const patterns = hostPatterns();
  manifest.host_permissions = patterns;
  manifest.content_scripts[0].matches = patterns;
  return manifest;
}
