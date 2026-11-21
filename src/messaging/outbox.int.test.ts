// SPEC: message-delivery/spec.md — outbox messages are queued with their change, sent by the job loop, retried with backoff, fall back to SMS, and dropped when no longer useful
// ROADMAP: phase-2-foundations / message-delivery / Implement outbox table and in-process job loop with retry and backoff
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { outboxMessage } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { openTestDb, resetDatabase } from "@/test/db";
import { createFakeClock } from "@/test/fake-clock";
import { createFakePush } from "@/test/fake-push";
import { createFakeSender } from "@/test/fake-sender";

import {
  applyProviderStatus,
  BACKOFF_SECONDS,
  MAX_ATTEMPTS,
  MessageDeliveryError,
  processOutbox,
  queueMessage,
  sendInline,
} from "./outbox";

const handle = openTestDb();
const { db } = handle;
const clock = createFakeClock();
const sender = createFakeSender();
const push = createFakePush();
const logger = createLogger({ clock, write: () => undefined });
const deps = { db, sender, push, clock, logger };

beforeEach(async () => {
  await resetDatabase(handle);
  sender.reset();
  push.reset();
  clock.set(new Date("2026-12-24T10:00:00Z"));
});
afterAll(() => handle.pool.end());

const link = {
  link: "https://wesal.example/ar/b/abc",
  deadlineAt: "2026-12-24T10:20:00Z",
};

const queueLink = (extra: { expiresAt?: Date } = {}) =>
  queueMessage(db, clock, {
    template: "booking-link",
    recipient: "+201001234567",
    values: link,
    locale: "ar",
    bookingId: 1,
    ...extra,
  });

const rows = () => db.select().from(outboxMessage).orderBy(outboxMessage.id);

describe("queueMessage", () => {
  it("records a queued WhatsApp message due now", async () => {
    await queueLink();
    const [row] = await rows();
    expect(row).toMatchObject({
      channel: "whatsapp",
      status: "queued",
      attempts: 0,
      template: "booking-link",
      locale: "ar",
      bookingId: 1,
    });
    expect(row!.nextAttemptAt).toEqual(clock.now());
  });

  it("rejects values that do not fit the template and writes nothing", async () => {
    await expect(
      queueMessage(db, clock, {
        template: "booking-link",
        recipient: "+20",
        values: { link: "nope", deadlineAt: "x" },
        locale: "en",
      }),
    ).rejects.toThrow();
    expect(await rows()).toHaveLength(0);
  });

  it("is not written when the surrounding transaction rolls back", async () => {
    await expect(
      db.transaction(async (tx) => {
        await queueMessage(tx, clock, {
          template: "booking-link",
          recipient: "+20",
          values: link,
          locale: "en",
        });
        throw new Error("the change failed");
      }),
    ).rejects.toThrow("the change failed");
    expect(await rows()).toHaveLength(0);
  });
});

describe("processOutbox", () => {
  it("sends a due message by WhatsApp in the recipient locale and marks it sent", async () => {
    await queueLink();
    const summary = await processOutbox(deps);
    expect(summary.sent).toBe(1);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({
      channel: "whatsapp",
      to: "+201001234567",
    });
    expect(sender.sent[0]!.body).toMatch(/[؀-ۿ]/);
    expect(sender.sent[0]!.body).toContain(link.link);
    const [row] = await rows();
    expect(row).toMatchObject({
      status: "sent",
      providerMessageId: "fake-1",
      lastError: null,
    });
  });

  it("does not send a message that is not due yet, nor one already sent", async () => {
    await queueLink();
    await db
      .update(outboxMessage)
      .set({ nextAttemptAt: new Date("2026-12-24T10:00:30Z") });
    expect((await processOutbox(deps)).sent).toBe(0);
    clock.advance(31_000);
    expect((await processOutbox(deps)).sent).toBe(1);
    clock.advance(3600_000);
    expect((await processOutbox(deps)).sent).toBe(0);
    expect(sender.sent).toHaveLength(1);
  });

  it("keeps a message queued through an outage and sends it with backoff, losing nothing", async () => {
    await queueLink();
    sender.failChannel("whatsapp");

    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      const summary = await processOutbox(deps);
      expect(summary.retried).toBe(1);
      const [row] = await rows();
      expect(row).toMatchObject({ status: "queued", attempts: attempt });
      expect(row!.lastError).toContain("whatsapp delivery failed");
      const delay = BACKOFF_SECONDS[attempt - 1]!;
      expect(row!.nextAttemptAt).toEqual(
        new Date(clock.now().getTime() + delay * 1000),
      );
      // Too early: nothing happens.
      clock.advance((delay - 1) * 1000);
      expect((await processOutbox(deps)).retried).toBe(0);
      clock.advance(1000);
    }

    sender.recover("whatsapp");
    expect((await processOutbox(deps)).sent).toBe(1);
    const [row] = await rows();
    expect(row).toMatchObject({ status: "sent", channel: "whatsapp" });
  });

  it("falls back to SMS when WhatsApp keeps failing, then fails for good when SMS does too", async () => {
    await queueLink();
    sender.failChannel("whatsapp");
    sender.failChannel("sms");
    let summary;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      summary = await processOutbox(deps);
      clock.advance(3600_000);
    }
    expect(summary!.fellBack).toBe(1);
    let [row] = await rows();
    expect(row).toMatchObject({
      channel: "sms",
      status: "queued",
      attempts: 0,
    });

    sender.recover("sms");
    expect((await processOutbox(deps)).sent).toBe(1);
    expect(sender.sent.at(-1)!.channel).toBe("sms");

    // And when SMS fails too, the message is marked failed after the maximum attempts.
    await resetDatabase(handle);
    sender.reset();
    sender.failChannel("sms");
    await queueMessage(db, clock, {
      template: "booking-link",
      recipient: "+20",
      values: link,
      locale: "en",
      channel: "sms",
    });
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      summary = await processOutbox(deps);
      clock.advance(3600_000);
    }
    expect(summary!.failed).toBe(1);
    [row] = await rows();
    expect(row).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
    expect((await processOutbox(deps)).failed).toBe(0);
  });

  it("drops a message past its expiry instead of sending it late", async () => {
    await queueLink({ expiresAt: new Date("2026-12-24T10:20:00Z") });
    clock.set(new Date("2026-12-24T10:21:00Z"));
    const summary = await processOutbox(deps);
    expect(summary.expired).toBe(1);
    expect(sender.sent).toHaveLength(0);
    const [row] = await rows();
    expect(row).toMatchObject({ status: "failed", lastError: "expired" });
  });

  it("marks a message with unrenderable values failed without blocking the next", async () => {
    await db.insert(outboxMessage).values({
      recipient: "+20",
      channel: "whatsapp",
      template: "booking-link",
      values: { link: "bad" },
      locale: "en",
      nextAttemptAt: clock.now(),
    });
    await queueLink();
    const summary = await processOutbox(deps);
    expect(summary).toMatchObject({ failed: 1, sent: 1 });
  });

  it("does not hand one message to two overlapping runs", async () => {
    await queueLink();
    const [a, b] = await Promise.all([
      processOutbox(deps),
      processOutbox(deps),
    ]);
    expect(a.sent + b.sent).toBe(1);
    expect(sender.sent).toHaveLength(1);
  });
});

describe("applyProviderStatus", () => {
  async function sentMessage(channel: "whatsapp" | "sms" = "whatsapp") {
    await queueMessage(db, clock, {
      template: "booking-link",
      recipient: "+201001234567",
      values: link,
      locale: "en",
      channel,
    });
    await processOutbox(deps);
    const [row] = await rows();
    return row!.providerMessageId!;
  }
  const apply = (sid: string, status: string) =>
    applyProviderStatus({ db, clock, logger }, sid, status);

  it("marks delivered and read messages delivered, and ignores a later failure", async () => {
    const sid = await sentMessage();
    expect(await apply(sid, "delivered")).toBe("delivered");
    expect((await rows())[0]!.status).toBe("delivered");
    expect(await apply(sid, "failed")).toBe("ignored");
    expect((await rows())[0]!.status).toBe("delivered");
  });

  it("queues an SMS fallback when WhatsApp is undelivered, once", async () => {
    const sid = await sentMessage();
    expect(await apply(sid, "undelivered")).toBe("fell-back");
    expect((await rows())[0]).toMatchObject({
      channel: "sms",
      status: "queued",
      attempts: 0,
    });
    // A repeated callback does not queue a second fallback.
    expect(await apply(sid, "undelivered")).toBe("ignored");

    await processOutbox(deps);
    expect(sender.sent.map((m) => m.channel)).toEqual(["whatsapp", "sms"]);
    expect((await rows())[0]).toMatchObject({
      status: "sent",
      providerMessageId: "fake-2",
    });
  });

  it("lets a late delivered status cancel a pending SMS fallback", async () => {
    const sid = await sentMessage();
    await apply(sid, "failed");
    expect(await apply(sid, "delivered")).toBe("delivered");
    await processOutbox(deps);
    expect(sender.sent).toHaveLength(1);
  });

  it("marks an SMS that is undelivered as failed", async () => {
    const sid = await sentMessage("sms");
    expect(await apply(sid, "undelivered")).toBe("failed");
    expect((await rows())[0]).toMatchObject({ status: "failed" });
  });

  it("ignores in-flight statuses and unknown message ids", async () => {
    const sid = await sentMessage();
    for (const status of ["queued", "sending", "sent"]) {
      expect(await apply(sid, status)).toBe("ignored");
    }
    expect((await rows())[0]!.status).toBe("sent");
    expect(await apply("SMunknown", "delivered")).toBe("unknown-message");
  });
});

describe("sendInline", () => {
  const input = {
    template: "code" as const,
    recipient: "+201001234567",
    values: { code: "123456", minutes: "10" },
    locale: "en" as const,
  };

  it("sends by WhatsApp and records nothing in the outbox", async () => {
    const result = await sendInline({ sender, logger }, input);
    expect(result.channel).toBe("whatsapp");
    expect(sender.sent[0]!.body).toContain("123456");
    expect(await rows()).toHaveLength(0);
  });

  it("falls back to SMS at once when WhatsApp fails", async () => {
    sender.failChannel("whatsapp");
    const result = await sendInline({ sender, logger }, input);
    expect(result.channel).toBe("sms");
  });

  it("throws MessageDeliveryError when both channels fail", async () => {
    sender.failChannel("whatsapp");
    sender.failChannel("sms");
    const error = await sendInline({ sender, logger }, input).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(MessageDeliveryError);
    expect((error as MessageDeliveryError).causes).toHaveLength(2);
  });
});

describe("outbox row lifecycle", () => {
  it("keeps the row's update time current", async () => {
    await queueLink();
    clock.advance(5_000);
    await processOutbox(deps);
    const [row] = await db
      .select()
      .from(outboxMessage)
      .where(eq(outboxMessage.id, 1));
    expect(row!.updatedAt).toEqual(clock.now());
  });
});
