import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildManifest } from "./manifest-data.mjs";
import { writeIcons } from "./write-icons.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const previewDist = path.join(root, "preview/dist");

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(previewDist, { recursive: true });

const common = {
  bundle: true,
  format: "iife",
  target: "chrome120",
  legalComments: "none",
  logLevel: "info",
};

await esbuild.build({
  ...common,
  entryPoints: [path.join(root, "src/extension/background.ts")],
  outfile: path.join(dist, "background.js"),
});
await esbuild.build({
  ...common,
  entryPoints: [path.join(root, "src/vinted/content.ts")],
  outfile: path.join(dist, "content.js"),
});
await esbuild.build({
  ...common,
  entryPoints: [path.join(root, "src/extension/popup.ts")],
  outfile: path.join(dist, "popup.js"),
});
await esbuild.build({
  ...common,
  entryPoints: [path.join(root, "preview/main.ts")],
  outfile: path.join(previewDist, "preview.js"),
});

fs.copyFileSync(path.join(root, "src/ui/popup.html"), path.join(dist, "popup.html"));
fs.copyFileSync(path.join(root, "src/ui/popup.css"), path.join(dist, "popup.css"));
fs.copyFileSync(path.join(root, "src/ui/popup.css"), path.join(previewDist, "popup.css"));
fs.writeFileSync(path.join(dist, "manifest.json"), `${JSON.stringify(buildManifest(), null, 2)}\n`);
writeIcons(path.join(dist, "icons"));
