import type { Clock } from "@/lib/clock";

export interface FakeClock extends Clock {
  /** Moves time forward by `ms` milliseconds. */
  advance(ms: number): void;
  advanceMinutes(minutes: number): void;
  set(to: Date): void;
}

/** A clock a test controls: create a hold, advance 21 minutes, assert. */
export function createFakeClock(
  start: Date = new Date("2026-01-01T10:00:00Z"),
): FakeClock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance(ms) {
      current += ms;
    },
    advanceMinutes(minutes) {
      current += minutes * 60_000;
    },
    set(to) {
      current = to.getTime();
    },
  };
}
