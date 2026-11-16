// SPEC: docs/architecture/overview.md — Health: web up, postgres answers, age of the job loop's last tick
// ROADMAP: phase-1-infrastructure / deployment / Add health endpoint and static fallback notice with venue phone and WhatsApp
import { beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import { createLogger } from "@/lib/logger";
import { recordTick, resetHeartbeat } from "@/lib/job-heartbeat";
import type { Runtime } from "@/lib/runtime";
import { createFakeClock } from "@/test/fake-clock";

import { createHealthOperation } from "./health";

const clock = createFakeClock();
const deps: Runtime = {
  clock,
  logger: createLogger({ clock, write: () => {} }),
};
const ctx = () =>
  createCallContext({ kind: "anonymous" }, { requestId: "r", deps });

beforeEach(() => resetHeartbeat());

describe("health.get", () => {
  it("reports web and database up, and no job tick yet", async () => {
    const result = await createHealthOperation(async () => {})({}, ctx());
    expect(result).toEqual({
      ok: true,
      data: { web: "up", database: "up", jobs: { lastTickAgeSeconds: null } },
    });
  });

  it("reports the age of the job loop's last tick", async () => {
    recordTick(clock);
    clock.advance(45_000);
    const result = await createHealthOperation(async () => {})({}, ctx());
    expect(result.ok && result.data.jobs.lastTickAgeSeconds).toBe(45);
  });

  it("fails with SERVICE_UNAVAILABLE when the database does not answer", async () => {
    const result = await createHealthOperation(async () => {
      throw new Error("connection refused");
    })({}, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(result.error.details).toMatchObject({ database: "down" });
    }
  });

  it("fails when the database ping hangs past the timeout", async () => {
    const result = await createHealthOperation(
      () => new Promise<void>(() => {}),
    )({}, ctx());
    expect(result.ok).toBe(false);
  }, 10_000);

  it("skips the database with ?probe=web", async () => {
    const result = await createHealthOperation(async () => {
      throw new Error("must not be called");
    })({ probe: "web" }, ctx());
    expect(result).toMatchObject({
      ok: true,
      data: { web: "up", database: "unchecked" },
    });
  });

  it("rejects an unknown probe", async () => {
    const result = await createHealthOperation(async () => {})(
      { probe: "x" },
      ctx(),
    );
    expect(result.ok).toBe(false);
  });
});
