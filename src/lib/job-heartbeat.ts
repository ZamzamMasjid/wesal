import type { Clock } from "./clock";

// The job loop (message-delivery) calls recordTick() every time it wakes. The
// health endpoint reports the age of the last tick, and the loop's watchdog
// exits the process when it grows too old (ADR-022). Held in module state: one
// process, one loop.

let lastTickAt: Date | null = null;

export function recordTick(clock: Clock): void {
  lastTickAt = clock.now();
}

/** Whole seconds since the last tick, or null while no loop has ticked yet. */
export function lastTickAgeSeconds(clock: Clock): number | null {
  if (lastTickAt === null) return null;
  return Math.max(
    0,
    Math.floor((clock.now().getTime() - lastTickAt.getTime()) / 1000),
  );
}

/** Test helper: forget any recorded tick. */
export function resetHeartbeat(): void {
  lastTickAt = null;
}
