// SPEC: docs/features/phone-verification — six boxes, numeric keyboard, paste fills all boxes, resend countdown
// ROADMAP: phase-2-foundations / phone-verification / Implement code entry step UI with resend timer and error states
import { describe, expect, it } from "vitest";

import {
  CODE_LENGTH,
  digitsOnly,
  formatCountdown,
  secondsUntil,
} from "./code-input";

describe("digitsOnly", () => {
  it("keeps digits and caps the code length", () => {
    expect(digitsOnly("123456")).toBe("123456");
    expect(digitsOnly("12 34-56")).toBe("123456");
    expect(digitsOnly("123456789")).toBe("123456");
    expect(digitsOnly("abc")).toBe("");
  });

  it("takes Arabic-Indic digits typed on an Arabic keyboard", () => {
    expect(digitsOnly("١٢٣٤٥٦")).toBe("123456");
    expect(digitsOnly("۱۲۳۴۵۶")).toBe("123456");
  });
});

describe("formatCountdown", () => {
  it("shows minutes and seconds with Latin digits", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(9)).toBe("0:09");
    expect(formatCountdown(45)).toBe("0:45");
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(125)).toBe("2:05");
  });

  it("never goes below zero and rounds a partial second up", () => {
    expect(formatCountdown(-3)).toBe("0:00");
    expect(formatCountdown(0.2)).toBe("0:01");
  });
});

describe("secondsUntil", () => {
  const now = new Date("2026-01-01T10:00:00Z").getTime();

  it("counts whole seconds left, never negative", () => {
    const inForty = new Date(now + 40_000).toISOString();
    expect(secondsUntil(inForty, now)).toBe(40);
    expect(secondsUntil(inForty, now + 50_000)).toBe(0);
    expect(secondsUntil("not a date", now)).toBe(0);
  });

  it("agrees with the code length the boxes expect", () => {
    expect(CODE_LENGTH).toBe(6);
  });
});
