// SPEC: docs/architecture/testing.md — time comes from the injected clock
// ROADMAP: phase-1-infrastructure / testing / Add test scaffold under src/test: factories, database helper, fake clock, fake sender
import { describe, expect, it } from "vitest";

import { createFakeClock } from "@/test/fake-clock";

import { systemClock } from "./clock";

describe("clocks", () => {
  it("system clock returns the current time", () => {
    expect(Math.abs(systemClock.now().getTime() - Date.now())).toBeLessThan(
      1000,
    );
  });

  it("fake clock advances 21 minutes without waiting", () => {
    const clock = createFakeClock(new Date("2026-01-01T10:00:00Z"));
    clock.advanceMinutes(21);
    expect(clock.now().toISOString()).toBe("2026-01-01T10:21:00.000Z");
    clock.advance(1000);
    expect(clock.now().toISOString()).toBe("2026-01-01T10:21:01.000Z");
    clock.set(new Date("2030-05-05T00:00:00Z"));
    expect(clock.now().getUTCFullYear()).toBe(2030);
  });
});
