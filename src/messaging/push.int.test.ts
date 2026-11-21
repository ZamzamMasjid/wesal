// SPEC: push-notifications/spec.md — staff alerts go to registered devices by push, choose push or WhatsApp, and fall back to WhatsApp when no device takes the alert
// ROADMAP: phase-7-mobile-app / push-notifications / Send push on proof upload and urgent holds to signed-in staff devices
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { outboxMessage, staffDevice, staffUser } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { MAX_ATTEMPTS, processOutbox } from "@/messaging/outbox";
import { queueStaffAlert } from "@/messaging/staff-alerts";
import { openTestDb, resetDatabase } from "@/test/db";
import { createFakeClock } from "@/test/fake-clock";
import { createFakePush } from "@/test/fake-push";
import { createFakeSender } from "@/test/fake-sender";
import { aStaffUser } from "@/test/factories";

const handle = openTestDb();
const { db } = handle;
const BASE_URL = "https://wesal.example";
const TOKEN = "ExponentPushToken[abcdefghijklmnop]";
const PHONE = "+201001234567";

const clock = createFakeClock();
const sender = createFakeSender();
const push = createFakePush();
const logger = createLogger({ clock, write: () => undefined });
const deps = { db, sender, push, clock, logger };

const booking = {
  id: 7,
  publicId: "ABC234",
  customerName: "Hassan",
  occasionNameAr: "زفاف",
  occasionNameEn: "Wedding",
  startsAt: new Date("2026-12-25T16:00:00Z"),
  depositEgp: 2500,
};

beforeEach(async () => {
  await resetDatabase(handle);
  sender.reset();
  push.reset();
  clock.set(new Date("2026-12-20T08:00:00Z"));
});
afterAll(() => handle.pool.end());

async function staff(
  overrides: Parameters<typeof aStaffUser>[0] = {},
  device = true,
) {
  await db.insert(staffUser).values(
    aStaffUser({
      id: "sara",
      name: "Sara",
      notifyPhone: PHONE,
      alertChannel: "push",
      locale: "en",
      ...overrides,
    }),
  );
  if (device) {
    await db.insert(staffDevice).values({
      userId: "sara",
      token: TOKEN,
      platform: "android",
    });
  }
}

async function rows() {
  return db.select().from(outboxMessage).orderBy(outboxMessage.id);
}

async function alert(kind: "proof" | "urgent" = "proof") {
  return queueStaffAlert(db, clock, {
    kind,
    booking,
    baseUrl: BASE_URL,
  });
}

/** Runs the loop through the retry schedule without waiting. */
async function drainRetries() {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await processOutbox(deps);
    clock.set(new Date(clock.now().getTime() + 3_600_000));
  }
}

describe("push staff alerts", () => {
  it("queues one push row per person and delivers to their devices", async () => {
    await staff();

    await alert("proof");

    const [queued] = await rows();
    expect(queued).toMatchObject({
      channel: "push",
      recipient: "sara",
      template: "staff-alert",
      status: "queued",
    });

    const summary = await processOutbox(deps);
    expect(summary.sent).toBe(1);
    expect(push.sent).toHaveLength(1);
    expect(push.sent[0]).toHaveLength(1);
    expect(push.sent[0]?.[0]).toMatchObject({
      to: TOKEN,
      title: "Payment proof to review",
      data: { link: `${BASE_URL}/en/dashboard/review/ABC234` },
    });
    expect(push.sent[0]?.[0]?.body).toContain("Hassan");

    const [stored] = await rows();
    expect(stored?.status).toBe("sent");
  });

  it("sends to every registered device of the person", async () => {
    await staff();
    await db.insert(staffDevice).values({
      userId: "sara",
      token: "ExponentPushToken[seconddevice]",
      platform: "ios",
    });

    await alert("urgent");
    await processOutbox(deps);

    expect(push.sent[0]?.map((message) => message.to)).toEqual([
      TOKEN,
      "ExponentPushToken[seconddevice]",
    ]);
  });

  it("keeps WhatsApp when the person chose WhatsApp", async () => {
    await staff({ alertChannel: "whatsapp" });

    await alert();

    const [queued] = await rows();
    expect(queued).toMatchObject({
      channel: "whatsapp",
      recipient: PHONE,
    });
    expect(push.sent).toHaveLength(0);
  });

  it("sends both when the person chose both", async () => {
    await staff({ alertChannel: "both" });

    await alert();

    const queued = await rows();
    expect(queued.map((row) => row.channel).sort()).toEqual([
      "push",
      "whatsapp",
    ]);
  });

  it("falls back to WhatsApp when push-only has no device", async () => {
    await staff({ alertChannel: "push" }, false);

    await alert();

    const [queued] = await rows();
    expect(queued).toMatchObject({
      channel: "whatsapp",
      recipient: PHONE,
    });
  });

  it("falls back to WhatsApp after the last push attempt fails", async () => {
    await staff();
    push.fail(new Error("Expo is down"));

    await alert();
    await drainRetries();

    const stored = await rows();
    const pushRow = stored.find((row) => row.channel === "push");
    const fallback = stored.find(
      (row) => row.channel === "whatsapp" && row.template === "staff-alert",
    );
    expect(pushRow).toMatchObject({
      status: "failed",
      attempts: MAX_ATTEMPTS,
    });
    expect(pushRow?.lastError).toContain("Expo is down");
    expect(fallback).toMatchObject({
      recipient: PHONE,
      status: "queued",
    });

    // The queued fallback goes out like any other WhatsApp alert.
    await processOutbox(deps);
    expect(sender.sent.at(-1)).toMatchObject({
      channel: "whatsapp",
      to: PHONE,
    });
  });

  it("deactivates a token the provider reports as unregistered", async () => {
    await staff();
    await db.insert(staffDevice).values({
      userId: "sara",
      token: "ExponentPushToken[seconddevice]",
      platform: "ios",
    });
    push.reject("DeviceNotRegistered", { invalid: true });

    await alert();
    await drainRetries();

    const devices = await db.select().from(staffDevice);
    expect(devices.every((device) => !device.active)).toBe(true);
    const fallback = (await rows()).find((row) => row.channel === "whatsapp");
    expect(fallback?.recipient).toBe(PHONE);
  });

  it("still alerts by WhatsApp when the push row expires before a device exists", async () => {
    await staff({ alertChannel: "push" }, false);
    await alert();

    await processOutbox(deps);

    const [stored] = await rows();
    expect(stored?.channel).toBe("whatsapp");
  });
});
