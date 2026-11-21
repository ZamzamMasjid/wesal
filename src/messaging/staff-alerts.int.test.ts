// SPEC: docs/features/staff-notifications — proofs and urgent holds alert staff by WhatsApp through the outbox, in each member's language, and the owner's phone is the fallback
// ROADMAP: phase-4-operations / staff-notifications / Queue staff alert on proof upload with a link to the review page
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { outboxMessage, staffUser } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { openTestDb, resetDatabase } from "@/test/db";
import { aStaffUser } from "@/test/factories";

import { queueStaffAlert, resolveStaffAlertRecipients } from "./staff-alerts";

const handle = openTestDb();
const { db } = handle;

const NOW = new Date("2026-12-20T08:00:00Z");
const BASE_URL = "https://wesal.example";
const clock: Clock = { now: () => NOW };

const bookingRow = {
  id: 7,
  publicId: "ABC234",
  customerName: "Hassan",
  occasionNameAr: "زفاف",
  occasionNameEn: "Wedding",
  startsAt: new Date("2026-12-25T16:00:00Z"),
  depositEgp: 2500,
};

beforeEach(() => resetDatabase(handle));
afterAll(() => handle.pool.end());

async function messages() {
  return db.select().from(outboxMessage).orderBy(outboxMessage.id);
}

describe("resolveStaffAlertRecipients", () => {
  it("keeps active, opted-in accounts that have a phone", async () => {
    await db
      .insert(staffUser)
      .values([
        aStaffUser({ id: "on", notifyPhone: "+201001111111", locale: "ar" }),
        aStaffUser({
          id: "off",
          notifyPhone: "+201002222222",
          notifyEnabled: false,
        }),
        aStaffUser({ id: "nophone" }),
        aStaffUser({
          id: "disabled",
          notifyPhone: "+201003333333",
          active: false,
        }),
      ]);

    const recipients = await resolveStaffAlertRecipients(db);
    expect(recipients).toEqual([
      {
        id: "on",
        phone: "+201001111111",
        locale: "ar",
        channel: "whatsapp",
        devices: 0,
      },
    ]);
  });

  it("falls back to the owner's phone when every alert is turned off", async () => {
    await db.insert(staffUser).values([
      aStaffUser({
        id: "owner",
        username: "owner",
        role: "owner",
        notifyPhone: "+201004444444",
        notifyEnabled: false,
      }),
      aStaffUser({
        id: "staff",
        notifyPhone: "+201005555555",
        notifyEnabled: false,
      }),
    ]);

    const recipients = await resolveStaffAlertRecipients(db);
    expect(recipients).toEqual([
      {
        id: "owner",
        phone: "+201004444444",
        locale: "ar",
        channel: "whatsapp",
        devices: 0,
      },
    ]);
  });

  it("returns nobody when no active account has a phone", async () => {
    await db
      .insert(staffUser)
      .values([
        aStaffUser({ id: "nophone" }),
        aStaffUser({
          id: "disabled",
          notifyPhone: "+201006666666",
          active: false,
        }),
      ]);
    expect(await resolveStaffAlertRecipients(db)).toEqual([]);
  });
});

describe("queueStaffAlert", () => {
  it("queues one message per recipient, in their language, with the review link", async () => {
    await db.insert(staffUser).values([
      aStaffUser({
        id: "ar",
        name: "Sara",
        notifyPhone: "+201001111111",
        locale: "ar",
      }),
      aStaffUser({
        id: "en",
        name: "Mona",
        notifyPhone: "+201002222222",
        locale: "en",
      }),
      aStaffUser({
        id: "off",
        name: "Nour",
        notifyPhone: "+201003333333",
        notifyEnabled: false,
      }),
    ]);

    const recipients = await queueStaffAlert(db, clock, {
      kind: "proof",
      booking: bookingRow,
      baseUrl: BASE_URL,
    });
    expect(recipients).toHaveLength(2);

    const sent = await messages();
    expect(sent).toHaveLength(2);
    const byLocale = new Map(sent.map((message) => [message.locale, message]));

    const arabic = byLocale.get("ar");
    expect(arabic).toMatchObject({
      bookingId: 7,
      recipient: "+201001111111",
      channel: "whatsapp",
      template: "staff-alert",
      locale: "ar",
      status: "queued",
      expiresAt: bookingRow.startsAt,
    });
    expect(arabic?.values).toMatchObject({
      kind: "proof",
      link: `${BASE_URL}/dashboard/review/ABC234`,
      occasion: "زفاف",
      customerName: "Hassan",
      slotStartAt: bookingRow.startsAt.toISOString(),
      depositEgp: "2500",
    });

    expect(byLocale.get("en")?.values).toMatchObject({
      kind: "proof",
      link: `${BASE_URL}/en/dashboard/review/ABC234`,
      occasion: "Wedding",
    });
  });

  it("does not include a deposit on an urgent hold alert", async () => {
    await db
      .insert(staffUser)
      .values(aStaffUser({ id: "on", notifyPhone: "+201001111111" }));

    await queueStaffAlert(db, clock, {
      kind: "urgent",
      booking: bookingRow,
      baseUrl: BASE_URL,
    });

    const [alert] = await messages();
    expect(alert?.values).toMatchObject({ kind: "urgent" });
    expect(alert?.values).not.toHaveProperty("depositEgp");
  });

  it("queues nothing and does not throw when nobody can be alerted", async () => {
    await queueStaffAlert(db, clock, {
      kind: "proof",
      booking: bookingRow,
      baseUrl: BASE_URL,
    });
    expect(await messages()).toEqual([]);
  });
});
