// SPEC: docs/architecture/overview.md — Health: web up, postgres answers, age of the job loop's last tick, and the WhatsApp session in WhatSend mode
// ROADMAP: phase-1-infrastructure / deployment / Add health endpoint and static fallback notice with venue phone and WhatsApp
import { beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import { createLogger } from "@/lib/logger";
import { recordTick, resetHeartbeat } from "@/lib/job-heartbeat";
import type { Runtime } from "@/lib/runtime";
import { createFakeClock } from "@/test/fake-clock";
import type { MessagingProbe } from "@/messaging/status";

import { createHealthOperation } from "./health";

const clock = createFakeClock();
const deps: Runtime = {
  clock,
  logger: createLogger({ clock, write: () => {} }),
};
const ctx = () =>
  createCallContext({ kind: "anonymous" }, { requestId: "r", deps });

const noMessaging: MessagingProbe = async () => ({ provider: "none" });

beforeEach(() => resetHeartbeat());

describe("health.get", () => {
  it("reports web and database up, and no job tick yet", async () => {
    const result = await createHealthOperation(async () => {}, noMessaging)(
      {},
      ctx(),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        web: "up",
        database: "up",
        jobs: { lastTickAgeSeconds: null },
        messaging: { provider: "none" },
      },
    });
  });

  it("reports the age of the job loop's last tick", async () => {
    recordTick(clock);
    clock.advance(45_000);
    const result = await createHealthOperation(async () => {}, noMessaging)(
      {},
      ctx(),
    );
    expect(result.ok && result.data.jobs.lastTickAgeSeconds).toBe(45);
  });

  it("reports the worker's session state in WhatSend mode", async () => {
    const result = await createHealthOperation(
      async () => {},
      async () => ({
        provider: "whatsend",
        session: "unlinked",
      }),
    )({}, ctx());
    expect(result).toMatchObject({
      ok: true,
      data: { messaging: { provider: "whatsend", session: "unlinked" } },
    });
  });

  it("logs one warning when the session stops being linked, not on every check", async () => {
    const lines: string[] = [];
    const logged: Runtime = {
      clock,
      logger: createLogger({ clock, write: (line) => lines.push(line) }),
    };
    const loggedCtx = () =>
      createCallContext(
        { kind: "anonymous" },
        { requestId: "r", deps: logged },
      );
    let session: "linked" | "unlinked" = "unlinked";
    const operation = createHealthOperation(
      async () => {},
      async () => ({
        provider: "whatsend",
        session,
      }),
    );

    await operation({}, loggedCtx());
    await operation({}, loggedCtx());
    session = "linked";
    await operation({}, loggedCtx());
    session = "unlinked";
    await operation({}, loggedCtx());

    const warnings = lines
      .map((line) => JSON.parse(line) as { msg?: string })
      .filter(
        (line) => line.msg === "health check: WhatsApp session is not linked",
      );
    expect(warnings).toHaveLength(2);
  });

  it("still answers when the messaging probe reports an unknown state", async () => {
    const result = await createHealthOperation(
      async () => {},
      async () => ({
        provider: "whatsend",
        session: "unknown",
      }),
    )({}, ctx());
    expect(result).toMatchObject({
      ok: true,
      data: { database: "up", messaging: { session: "unknown" } },
    });
  });

  it("fails with SERVICE_UNAVAILABLE when the database does not answer", async () => {
    const result = await createHealthOperation(async () => {
      throw new Error("connection refused");
    }, noMessaging)({}, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(result.error.details).toMatchObject({ database: "down" });
    }
  });

  it("fails when the database ping hangs past the timeout", async () => {
    const result = await createHealthOperation(
      () => new Promise<void>(() => {}),
      noMessaging,
    )({}, ctx());
    expect(result.ok).toBe(false);
  }, 10_000);

  it("skips the database and messaging with ?probe=web", async () => {
    const result = await createHealthOperation(
      async () => {
        throw new Error("must not be called");
      },
      async () => {
        throw new Error("must not be called");
      },
    )({ probe: "web" }, ctx());
    expect(result).toMatchObject({
      ok: true,
      data: { web: "up", database: "unchecked" },
    });
    expect(result.ok && result.data.messaging).toBeUndefined();
  });

  it("rejects an unknown probe", async () => {
    const result = await createHealthOperation(async () => {}, noMessaging)(
      { probe: "x" },
      ctx(),
    );
    expect(result.ok).toBe(false);
  });
});
