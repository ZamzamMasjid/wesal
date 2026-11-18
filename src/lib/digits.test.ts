// SPEC: docs/features/phone-verification — phone numbers and codes are Latin digits in both languages, whatever keyboard produced them
// ROADMAP: phase-2-foundations / phone-verification / Implement request-code endpoint: hashed code, expiry, rate limits per phone and IP
import { describe, expect, it } from "vitest";

import { latinDigits } from "./digits";

describe("latinDigits", () => {
  it("turns Arabic-Indic and Extended Arabic-Indic digits into ASCII", () => {
    expect(latinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(latinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("keeps everything else as it is", () => {
    expect(latinDigits("+20 100")).toBe("+20 100");
    expect(latinDigits("abc")).toBe("abc");
    expect(latinDigits("")).toBe("");
  });
});
