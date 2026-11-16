// SPEC: message-delivery/spec.md — the job loop runs inside the app machine; ADR-022: runs are isolated and time-limited, a stalled loop restarts the process
// ROADMAP: phase-2-foundations / message-delivery / Implement outbox table and in-process job loop with retry and backoff
import { beforeEach, describe, expect, it, vi } from "vitest";

import { lastTickAgeSeconds, resetHeartbeat } from "@/lib/job-heartbeat";
import { createLogger } from "@/lib/logger";
import { createFakeClock } from "@/test/fake-clock";

import { createJobLoop } from "./loop";

const clock = createFakeClock();
const lines: string[] = [];
const logger = createLogger({
  clock,
  level: "debug",
  write: (line) => lines.push(line),
});

beforeEach(() => {
  lines.length = 0;
  resetHeartbeat();
});

describe("job loop", () => {
  it("runs every job on a tick and records the tick", async () => {
    const ran: string[] = [];
    const loop = createJobLoop({
      clock,
      logger,
      jobs: [
        { name: "a", run: async () => void ran.push("a") },
        { name: "b", run: async () => void ran.push("b") },
      ],
    });
    await loop.tick();
    expect(ran).toEqual(["a", "b"]);
    expect(lastTickAgeSeconds(clock)).toBe(0);
  });

  it("logs a job that throws and still runs the next job", async () => {
    const next = vi.fn(async () => undefined);
    const loop = createJobLoop({
      clock,
      logger,
      jobs: [
        {
          name: "bad",
          run: async () => {
            throw new Error("boom");
          },
        },
        {
          name: "sync-bad",
          run: () => {
            throw new Error("sync boom");
          },
        },
        { name: "good", run: next },
      ],
    });
    await loop.tick();
    expect(next).toHaveBeenCalledOnce();
    const errors = lines
      .map((l) => JSON.parse(l))
      .filter((l) => l.level === "error");
    expect(errors.map((e) => e.job)).toEqual(["bad", "sync-bad"]);
  });

  it("abandons a run that exceeds the time limit and carries on", async () => {
    const next = vi.fn(async () => undefined);
    const loop = createJobLoop({
      clock,
      logger,
      runTimeoutMs: 20,
      jobs: [
        { name: "hung", run: () => new Promise(() => undefined) },
        { name: "good", run: next },
      ],
    });
    await loop.tick();
    expect(next).toHaveBeenCalledOnce();
    expect(lines.some((l) => l.includes("timed out"))).toBe(true);
  });

  it("fires the watchdog only when the last tick is too old", async () => {
    const onStall = vi.fn();
    const loop = createJobLoop({
      clock,
      logger,
      jobs: [],
      staleAfterSeconds: 60,
      onStall,
    });
    expect(loop.checkWatchdog()).toBe(false); // no tick yet
    await loop.tick();
    clock.advance(60_000);
    expect(loop.checkWatchdog()).toBe(false);
    clock.advance(2_000);
    expect(loop.checkWatchdog()).toBe(true);
    expect(onStall).toHaveBeenCalledWith(62);
    expect(lines.some((l) => l.includes("job loop stalled"))).toBe(true);
    await loop.tick();
    expect(loop.checkWatchdog()).toBe(false);
  });

  it("beats after every job so a long multi-job tick does not look stalled", async () => {
    const ages: Array<number | null> = [];
    const loop = createJobLoop({
      clock,
      logger,
      jobs: [
        { name: "slow", run: async () => clock.advance(100_000) },
        {
          name: "probe",
          run: async () => void ages.push(lastTickAgeSeconds(clock)),
        },
      ],
      staleAfterSeconds: 120,
    });
    await loop.tick();
    // 100 s into the tick, the second job still sees a fresh heartbeat.
    expect(ages).toEqual([0]);
    expect(loop.checkWatchdog()).toBe(false);
  });

  it("start ticks repeatedly until stopped", async () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn(async () => undefined);
      const loop = createJobLoop({
        clock,
        logger,
        intervalMs: 1_000,
        jobs: [{ name: "j", run }],
      });
      loop.start();
      loop.start(); // a second start is a no-op
      await vi.advanceTimersByTimeAsync(3_500);
      expect(run.mock.calls.length).toBeGreaterThanOrEqual(3);
      loop.stop();
      const calls = run.mock.calls.length;
      await vi.advanceTimersByTimeAsync(5_000);
      expect(run.mock.calls.length).toBe(calls);
    } finally {
      vi.useRealTimers();
    }
  });
});
