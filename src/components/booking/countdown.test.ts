// SPEC: docs/design/views/booking-status.md — the countdown is announced once a minute, then every second of the last ten, and its color is backed by text
// ROADMAP: phase-3-booking / booking-page / Implement booking-status view: transfer details, deposit, countdown, status
import { describe, expect, it } from "vitest";

import { clockLabel, countdownWarning, shouldAnnounce } from "./countdown";

describe("clockLabel", () => {
  it("shows minutes and seconds like the design's 17:42", () => {
    expect(clockLabel(1062)).toBe("17:42");
    expect(clockLabel(303)).toBe("5:03");
    expect(clockLabel(59)).toBe("0:59");
    expect(clockLabel(0)).toBe("0:00");
  });

  it("grows an hours field only for a long hold", () => {
    expect(clockLabel(3723)).toBe("1:02:03");
  });

  it("never shows a negative clock", () => {
    expect(clockLabel(-5)).toBe("0:00");
  });
});

describe("countdownWarning", () => {
  it("turns warning under five minutes and danger under one", () => {
    expect(countdownWarning(300, true)).toBeNull();
    expect(countdownWarning(299, true)).toBe("under-five");
    expect(countdownWarning(60, true)).toBe("under-five");
    expect(countdownWarning(59, true)).toBe("under-one");
  });

  it("says nothing when the booking is not held or the clock is done", () => {
    expect(countdownWarning(120, false)).toBeNull();
    expect(countdownWarning(0, true)).toBeNull();
  });
});

describe("shouldAnnounce", () => {
  it("does not announce the first value", () => {
    expect(shouldAnnounce(1200, null)).toBe(false);
  });

  it("announces each minute boundary while more than ten seconds remain", () => {
    expect(shouldAnnounce(1199, 1200)).toBe(false);
    expect(shouldAnnounce(1140, 1141)).toBe(true);
    expect(shouldAnnounce(61, 62)).toBe(false);
  });

  it("announces every second of the last ten", () => {
    expect(shouldAnnounce(10, 11)).toBe(true);
    expect(shouldAnnounce(9, 10)).toBe(true);
    expect(shouldAnnounce(1, 2)).toBe(true);
  });

  it("leaves zero to the assertive status change", () => {
    expect(shouldAnnounce(0, 1)).toBe(false);
  });

  it("stays quiet when a refresh nudges the clock upward", () => {
    expect(shouldAnnounce(1001, 1000)).toBe(false);
  });
});
