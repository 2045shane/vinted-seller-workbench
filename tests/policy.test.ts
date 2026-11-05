import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildManifest } from "../scripts/manifest-data.mjs";

const root = path.resolve(import.meta.dirname, "..");

function sourceFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") || full.endsWith(".css") || full.endsWith(".html") || full.endsWith(".json") ? [full] : [];
  });
}

describe("v1 boundaries", () => {
  it("does not bundle a payment SDK, relist, or a password field", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
    expect(packageJson.dependencies ?? {}).toEqual({});
    const forbidden = /creem|stripe|paypal|lemonsqueezy|paddle|relist|chrome\.cookies|type=["']password["']/i;
    const offenders = sourceFiles(path.join(root, "src")).filter((file) => {
      const source = fs.readFileSync(file, "utf8").replaceAll("AUTO_RELIST_IN_V1", "");
      return forbidden.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("limits the manifest to the Vinted session", () => {
    const manifest = buildManifest();
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["storage", "tabs", "scripting"]);
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
    expect(JSON.stringify(manifest)).not.toContain("http://");
    expect(manifest.host_permissions).toContain("https://vinted.fr/*");
    expect(manifest.host_permissions).toContain("https://*.vinted.co.uk/*");
    expect(manifest.content_scripts[0].matches).toEqual(manifest.host_permissions);
    expect(manifest.content_scripts[0].js).toEqual(["content.js"]);
    expect(manifest.description.length).toBeLessThanOrEqual(132);
    expect(manifest.permissions).not.toContain("cookies");
    expect(manifest.permissions).not.toContain("alarms");
  });
});
