import { z } from "zod";

import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { twilioStatusUrl } from "@/messaging/config";
import { applyProviderStatus } from "@/messaging/outbox";
import { verifyTwilioSignature } from "@/messaging/twilio";

// POST /api/v1/webhooks/twilio/status (message-delivery). Twilio reports what
// happened to a message it accepted. The caller is anonymous; the request
// signature is the proof. A WhatsApp message reported undelivered is queued
// again as SMS (ADR-011).

export interface TwilioStatusDeps {
  db: Database;
  /** The Twilio auth token; undefined when Twilio is not configured. */
  authToken: string | undefined;
  /** The exact public URL Twilio posts to: it is part of what is signed. */
  webhookUrl: () => string;
}

const input = z.object({
  signature: z.string().nullable(),
  params: z.record(z.string(), z.string()),
});

const statusParams = z.object({
  MessageSid: z.string().min(1),
  MessageStatus: z.string().min(1),
});

export function createTwilioStatusOperation(resolve: () => TwilioStatusDeps) {
  return defineOperation({
    name: "webhooks.twilio.status",
    access: "anonymous",
    input,
    handler: async ({ signature, params }, ctx) => {
      const deps = resolve();
      if (
        !deps.authToken ||
        !verifyTwilioSignature(
          deps.authToken,
          deps.webhookUrl(),
          params,
          signature,
        )
      ) {
        ctx.log.warn("twilio status webhook: signature check failed");
        throw new ApiError("FORBIDDEN", "Invalid signature.");
      }
      const parsed = statusParams.safeParse(params);
      if (!parsed.success) {
        throw new ApiError("VALIDATION_FAILED", "Missing message status.");
      }
      const outcome = await applyProviderStatus(
        { db: deps.db, clock: ctx.clock, logger: ctx.log },
        parsed.data.MessageSid,
        parsed.data.MessageStatus,
      );
      if (outcome === "unknown-message") {
        ctx.log.warn("twilio status webhook: no outbox message for this id");
      }
      // Always a 2xx for a valid signature, so Twilio does not retry.
      return { outcome };
    },
  });
}

export const twilioStatusOperation = createTwilioStatusOperation(() => ({
  db: getDb(),
  authToken: process.env.TWILIO_AUTH_TOKEN,
  webhookUrl: () => twilioStatusUrl(),
}));
