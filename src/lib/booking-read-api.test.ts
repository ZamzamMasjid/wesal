// SPEC: docs/features/booking-page — a typed booking ID is read back forgivingly, and the countdown is measured from the server's deadline and clock
// ROADMAP: phase-3-booking / booking-page / Implement find-my-booking form by booking ID
import { describe, expect, it } from "vitest";

import { normalizeBookingId, remainingFromServer } from "./booking-read-api";

describe("normalizeBookingId", () => {
  it("upper-cases and drops spaces and hyphens", () => {
    expect(normalizeBookingId(" 7k3m9q ")).toBe("7K3M9Q");
    expect(normalizeBookingId("7K3-M9Q")).toBe("7K3M9Q");
    expect(normalizeBookingId("7k3 m9q")).toBe("7K3M9Q");
  });

  it("turns Arabic-Indic digits into Latin digits", () => {
    expect(normalizeBookingId("١٢٣٤٥٦")).toBe("123456");
    expect(normalizeBookingId("۱۲۳۴۵۶")).toBe("123456");
  });

  it("leaves junk for the server to answer as not found", () => {
    expect(normalizeBookingId("!!!")).toBe("!!!");
    expect(normalizeBookingId("")).toBe("");
  });
});

describe("remainingFromServer", () => {
  it("measures the hold from the server's own clock", () => {
    expect(
      remainingFromServer(
        "2026-12-20T08:20:00.000Z",
        "2026-12-20T08:00:00.000Z",
      ),
    ).toBe(1200);
  });

  it("rounds up a partial second so it never shows less time than is left", () => {
    expect(
      remainingFromServer(
        "2026-12-20T08:00:01.500Z",
        "2026-12-20T08:00:00.000Z",
      ),
    ).toBe(2);
  });

  it("never goes negative and handles a missing deadline", () => {
    expect(
      remainingFromServer(
        "2026-12-20T07:59:00.000Z",
        "2026-12-20T08:00:00.000Z",
      ),
    ).toBe(0);
    expect(remainingFromServer(null, "2026-12-20T08:00:00.000Z")).toBe(0);
  });

  it("returns zero for an unreadable timestamp", () => {
    expect(remainingFromServer("nonsense", "2026-12-20T08:00:00.000Z")).toBe(0);
  });
});
