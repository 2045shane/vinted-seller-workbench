import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CUT_ID, FREE_DAILY_CSV_ROWS, FREE_DAILY_REPRICE_ITEMS, LOCAL_LICENSE_UNLOCK_CODE } from "../src/core/constants";

const root = path.resolve(import.meta.dirname, "..");

describe("handoff docs", () => {
  it("keeps the cut, caps, unlock rule, Creem note, and terms in both languages", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    const featureMap = fs.readFileSync(path.join(root, "FEATURE_MAP.md"), "utf8");
    for (const doc of [readme, featureMap]) {
      expect(doc).toContain(CUT_ID);
      expect(doc).toContain(String(FREE_DAILY_REPRICE_ITEMS));
      expect(doc).toContain(String(FREE_DAILY_CSV_ROWS));
      expect(doc).toContain(LOCAL_LICENSE_UNLOCK_CODE);
      expect(doc).toContain("Creem");
      expect(doc).toContain("Feature Map");
    }
    expect(readme).toContain("## English");
    expect(readme).toContain("## 中文");
    expect(readme).toContain("功能地图");
    expect(readme).toContain("npm test");
    expect(readme).toContain("terms");
    expect(readme).toContain("免责声明");
    expect(readme).toContain("自动 / 定时 Relist");
    expect(featureMap).toContain("功能地图");
  });
});
