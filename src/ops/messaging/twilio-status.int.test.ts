// SPEC: message-delivery/spec.md — POST /api/v1/webhooks/twilio/status: delivery status callbacks, signature-checked, trigger SMS fallback
// ROADMAP: phase-2-foundations / message-delivery / Implement Twilio status webhook with signature check and SMS fallback
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import { outboxMessage } from "@/db/schema";
import { processOutbox, queueMessage } from "@/messaging/outbox";
import { twilioSignature } from "@/messaging/twilio";
import { openTestDb, resetDatabase } from "@/test/db";
import { createFakeClock } from "@/test/fake-clock";
import { createFakeSender } from "@/test/fake-sender";
import { createLogger } from "@/lib/logger";

import { createTwilioStatusOperation } from "./twilio-status";

const handle = openTestDb();
const { db } = handle;
const clock = createFakeClock();
const sender = createFakeSender();
const logger = createLogger({ clock, write: () => undefined });

const TOKEN = "test-auth-token";
const URL_ = "https://wesal.example/api/v1/webhooks/twilio/status";
const op = createTwilioStatusOperation(() => ({
  db,
  authToken: TOKEN,
  webhookUrl: () => URL_,
}));
const unconfigured = createTwilioStatusOperation(() => ({
  db,
  authToken: undefined,
  webhookUrl: () => URL_,
}));

const ctx = () => ({
  ...createCallContext({ kind: "anonymous" }, { requestId: "r" }),
  clock,
});

beforeEach(async () => {
  await resetDatabase(handle);
  sender.reset();
});
afterAll(() => handle.pool.end());

const signed = (params: Record<string, string>) => ({
  signature: twilioSignature(TOKEN, URL_, params),
  params,
});

async function sendWhatsapp(): Promise<string> {
  await queueMessage(db, clock, {
    template: "booking-link",
    recipient: "+201001234567",
    values: {
      link: "https://wesal.example/ar/b/abc",
      deadlineAt: "2026-01-01T10:20:00Z",
    },
    locale: "ar",
  });
  await processOutbox({ db, sender, clock, logger });
  const [row] = await db.select().from(outboxMessage);
  return row!.providerMessageId!;
}

describe("webhooks.twilio.status", () => {
  it("is open to anonymous callers (the signature is the proof)", () => {
    expect(op.access).toBe("anonymous");
  });

  it("rejects a missing or wrong signature with FORBIDDEN and changes nothing", async () => {
    const sid = await sendWhatsapp();
    const params = { MessageSid: sid, MessageStatus: "undelivered" };
    for (const signature of [
      null,
      "bogus",
      twilioSignature("other-token", URL_, params),
    ]) {
      const result = await op({ signature, params }, ctx());
      expect(!result.ok && result.error.code).toBe("FORBIDDEN");
    }
    const [row] = await db.select().from(outboxMessage);
    expect(row).toMatchObject({ status: "sent", channel: "whatsapp" });
  });

  it("rejects every call when Twilio is not configured", async () => {
    const params = { MessageSid: "SM1", MessageStatus: "delivered" };
    const result = await unconfigured(signed(params), ctx());
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });

  it("rejects a signed call without a message id or status", async () => {
    const result = await op(signed({ To: "+20" }), ctx());
    expect(!result.ok && result.error.code).toBe("VALIDATION_FAILED");
  });

  it("marks the message delivered", async () => {
    const sid = await sendWhatsapp();
    const result = await op(
      signed({ MessageSid: sid, MessageStatus: "delivered", To: "+20" }),
      ctx(),
    );
    expect(result).toEqual({ ok: true, data: { outcome: "delivered" } });
    const [row] = await db.select().from(outboxMessage);
    expect(row!.status).toBe("delivered");
  });

  it("sends the message again by SMS when WhatsApp reports undelivered", async () => {
    const sid = await sendWhatsapp();
    const result = await op(
      signed({ MessageSid: sid, MessageStatus: "undelivered" }),
      ctx(),
    );
    expect(result).toEqual({ ok: true, data: { outcome: "fell-back" } });
    await processOutbox({ db, sender, clock, logger });
    expect(sender.sent.map((m) => m.channel)).toEqual(["whatsapp", "sms"]);
  });

  it("answers success for an unknown message so Twilio does not retry", async () => {
    const result = await op(
      signed({ MessageSid: "SMnope", MessageStatus: "delivered" }),
      ctx(),
    );
    expect(result).toEqual({ ok: true, data: { outcome: "unknown-message" } });
  });
});
