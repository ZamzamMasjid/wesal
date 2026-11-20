// SPEC: docs/features/booking-hold — the hold deadline is the shorter of the hold length and the near-slot cutoff, and a slot inside the urgent threshold is flagged for staff
// ROADMAP: phase-3-booking / booking-hold / Implement near-slot deadline cutoff and urgent flag
import { describe, expect, it } from "vitest";

import {
  generateAccessToken,
  generatePublicId,
  holdDeadline,
  isUrgent,
} from "./hold";

const NOW = new Date("2026-12-20T08:00:00Z");
const at = (iso: string) => new Date(iso);

describe("holdDeadline", () => {
  it("is the hold length after now for a slot far away", () => {
    expect(holdDeadline(NOW, at("2026-12-25T16:00:00Z"), 20, 120)).toEqual(
      at("2026-12-20T08:20:00Z"),
    );
  });

  it("stops at the near-slot cutoff when the slot starts soon", () => {
    // The slot starts in 130 minutes, so 20 minutes of hold would run past the
    // moment two hours before it.
    expect(holdDeadline(NOW, at("2026-12-20T10:10:00Z"), 20, 120)).toEqual(
      at("2026-12-20T08:10:00Z"),
    );
  });

  it("never runs past the cutoff even with a long hold", () => {
    expect(holdDeadline(NOW, at("2026-12-20T12:00:00Z"), 600, 120)).toEqual(
      at("2026-12-20T10:00:00Z"),
    );
  });
});

describe("isUrgent", () => {
  it("flags a slot inside the threshold, inclusive", () => {
    expect(isUrgent(NOW, at("2026-12-20T08:00:00Z"), 1440)).toBe(true);
    expect(isUrgent(NOW, at("2026-12-21T08:00:00Z"), 1440)).toBe(true);
  });

  it("does not flag a slot beyond the threshold", () => {
    expect(isUrgent(NOW, at("2026-12-21T08:01:00Z"), 1440)).toBe(false);
  });
});

describe("identifiers", () => {
  it("generates a six-character public id without look-alike characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePublicId()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it("generates a URL-safe access token with enough entropy", () => {
    const token = generateAccessToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(generateAccessToken()).not.toBe(token);
  });
});
