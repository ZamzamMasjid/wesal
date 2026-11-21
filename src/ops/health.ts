import { sql } from "drizzle-orm";
import { z } from "zod";

import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb } from "@/db/client";
import { lastTickAgeSeconds } from "@/lib/job-heartbeat";
import {
  createMessagingProbe,
  type MessagingHealth,
  type MessagingProbe,
} from "@/messaging/status";

// The health operation (overview: "Health"). Fly uses it to decide whether a
// new deploy is good; the developer reads it to see that jobs and messaging
// are running.
//
//   GET /api/v1/health             web up, postgres answers, job-loop tick age,
//                                  and, in WhatSend mode, whether the worker's
//                                  WhatsApp session is linked; 503 when postgres
//                                  does not answer
//   GET /api/v1/health?probe=web   web up only. Fly's check uses this one, so a
//                                  database outage keeps the machine in rotation
//                                  and visitors see the static notice, not Fly's
//                                  error page. The release command has already
//                                  proved the database reachable (ADR-021). The
//                                  messaging probe is skipped so a deploy check
//                                  never waits on the worker.

const DATABASE_TIMEOUT_MS = 2_000;

export interface HealthData {
  web: "up";
  database: "up" | "down" | "unchecked";
  jobs: { lastTickAgeSeconds: number | null };
  /** Present on the full check; absent from ?probe=web. */
  messaging?: MessagingHealth;
}

export type DatabasePing = () => Promise<void>;

async function pingDatabase(): Promise<void> {
  await getDb().execute(sql`select 1`);
}

function withTimeout(ping: DatabasePing, ms: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("database ping timed out")),
      ms,
    );
    ping().then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function createHealthOperation(
  ping: DatabasePing = pingDatabase,
  probeMessaging: MessagingProbe = createMessagingProbe(),
) {
  // Warn once when the session stops being linked, not on every check.
  let lastSession: string | undefined;

  return defineOperation({
    name: "health.get",
    access: "anonymous",
    input: z.object({ probe: z.literal("web").optional() }),
    handler: async (input, ctx): Promise<HealthData> => {
      const jobs = { lastTickAgeSeconds: lastTickAgeSeconds(ctx.clock) };
      if (input.probe === "web") {
        return { web: "up", database: "unchecked", jobs };
      }
      try {
        await withTimeout(ping, DATABASE_TIMEOUT_MS);
      } catch (err) {
        ctx.log.error("health check: database unreachable", { err });
        throw new ApiError(
          "SERVICE_UNAVAILABLE",
          "The database is not answering.",
          {
            web: "up",
            database: "down",
            jobs,
          },
        );
      }
      const messaging = await probeMessaging();
      if (messaging.session && messaging.session !== lastSession) {
        lastSession = messaging.session;
        if (messaging.session !== "linked") {
          ctx.log.warn("health check: WhatsApp session is not linked", {
            session: messaging.session,
          });
        }
      }
      return { web: "up", database: "up", jobs, messaging };
    },
  });
}

export const getHealth = createHealthOperation();
