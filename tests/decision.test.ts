import { describe, expect, it } from "vitest";
import {
  AUTO_RELIST_IN_V1,
  CUT_ID,
  FREE_DAILY_CSV_ROWS,
  FREE_DAILY_REPRICE_ITEMS,
  LOCAL_LICENSE_UNLOCK_CODE,
  PAYMENT_SDK_IN_V1,
  WARDROBE_READ_IS_UNLIMITED,
} from "../src/core/constants";

describe("Shane Decision 2026-11-05", () => {
  it("keeps the locked cut defaults in one module", () => {
    expect(CUT_ID).toBe("VINTED-SELLER-CUT-2026-11-05-v1");
    expect(AUTO_RELIST_IN_V1).toBe(false);
    expect(PAYMENT_SDK_IN_V1).toBe(false);
    expect(WARDROBE_READ_IS_UNLIMITED).toBe(true);
    expect(FREE_DAILY_REPRICE_ITEMS).toBe(25);
    expect(FREE_DAILY_CSV_ROWS).toBe(100);
    expect(LOCAL_LICENSE_UNLOCK_CODE).toBe("VSW-STUB-UNLIMITED");
  });
});
