// SPEC: docs/features/phone-verification — six-digit codes, stored hashed and compared in constant time; Egyptian numbers are the expected case
// ROADMAP: phase-2-foundations / phone-verification / Implement request-code endpoint: hashed code, expiry, rate limits per phone and IP
import { describe, expect, it } from "vitest";

import {
  CODE_DIGITS,
  codeMatches,
  generateCode,
  hashCode,
  isE164,
  normalizePhone,
} from "./phone";

const secret = "test-secret";

describe("normalizePhone", () => {
  it("cleans what people type and keeps E.164", () => {
    expect(normalizePhone("+20 100 123 4567")).toBe("+201001234567");
    expect(normalizePhone("+20-100-123-4567")).toBe("+201001234567");
    expect(normalizePhone("(+20) 100.123.4567")).toBe("+201001234567");
    expect(normalizePhone("00201001234567")).toBe("+201001234567");
  });

  it("adds the Egyptian country code to a local mobile number", () => {
    expect(normalizePhone("01001234567")).toBe("+201001234567");
    expect(normalizePhone(" 0100 123 4567 ")).toBe("+201001234567");
  });

  it("leaves other international numbers alone", () => {
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("+966501234567")).toBe("+966501234567");
  });

  it("reads Arabic-Indic digits typed on an Arabic keyboard", () => {
    expect(normalizePhone("٠١٠٠١٢٣٤٥٦٧")).toBe("+201001234567");
    expect(normalizePhone("+٢٠ ١٠٠ ١٢٣ ٤٥٦٧")).toBe("+201001234567");
  });
});

describe("isE164", () => {
  it("accepts international numbers and refuses the rest", () => {
    expect(isE164("+201001234567")).toBe(true);
    expect(isE164("+447700900123")).toBe(true);
    for (const bad of ["", "201001234567", "+0123456789", "+20", "phone"]) {
      expect(isE164(bad)).toBe(false);
    }
  });
});

describe("generateCode", () => {
  it("makes a six-digit code, keeping leading zeros", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateCode()).toMatch(new RegExp(`^\\d{${CODE_DIGITS}}$`));
    }
  });

  it("does not repeat itself", () => {
    const codes = new Set(Array.from({ length: 50 }, generateCode));
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe("code hashing", () => {
  it("is deterministic for the same phone, code and secret", () => {
    expect(hashCode("+201001234567", "123456", secret)).toBe(
      hashCode("+201001234567", "123456", secret),
    );
  });

  it("binds the hash to the phone, the code and the secret", () => {
    const base = hashCode("+201001234567", "123456", secret);
    expect(hashCode("+201001234568", "123456", secret)).not.toBe(base);
    expect(hashCode("+201001234567", "123457", secret)).not.toBe(base);
    expect(hashCode("+201001234567", "123456", "other")).not.toBe(base);
  });

  it("never stores the code itself", () => {
    expect(hashCode("+201001234567", "123456", secret)).not.toContain("123456");
  });

  it("matches only the right code and survives a malformed stored hash", () => {
    const hash = hashCode("+201001234567", "123456", secret);
    expect(codeMatches(hash, "+201001234567", "123456", secret)).toBe(true);
    expect(codeMatches(hash, "+201001234567", "654321", secret)).toBe(false);
    expect(codeMatches(hash, "+201001234568", "123456", secret)).toBe(false);
    expect(codeMatches("not-hex", "+201001234567", "123456", secret)).toBe(
      false,
    );
  });
});
