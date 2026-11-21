// SPEC: docs/features/payment-review — staff see proofs waiting, confirm or reject with audit rows, and mark a WhatsApp proof received
// ROADMAP: phase-4-operations / payment-review / Implement review queue API and confirm/reject endpoints with audit entries
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import {
  auditLog,
  booking,
  occasion,
  paymentProof,
  staffUser,
} from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { orderReviewQueue } from "@/lib/review-api";
import { openTestDb, resetDatabase } from "@/test/db";
import { aBooking, anOccasion, aStaffUser } from "@/test/factories";

import { createReviewOperations } from "./review";

const handle = openTestDb();
const { db } = handle;

const NOW = new Date("2026-12-20T08:00:00Z");
let now = NOW;
const clock: Clock = { now: () => now };
const ops = createReviewOperations(() => ({
  db,
  baseUrl: "https://wesal.example",
}));

const base = createCallContext(
  { kind: "staff", userId: "staff-1", role: "staff" },
  { requestId: "review-test" },
);
const staff = { ...base, clock };
const anonymous = { ...createCallContext({ kind: "anonymous" }), clock };

afterAll(async () => {
  await handle.pool.end();
});

beforeEach(async () => {
  now = NOW;
  slotSequence = 0;
  await resetDatabase(handle);
  await db.insert(occasion).values(anOccasion({ priceEgp: 2000 }));
  await db
    .insert(staffUser)
    .values(aStaffUser({ id: "staff-1", name: "Reviewer" }));
});

let slotSequence = 0;

async function aStoredBooking(
  overrides: Parameters<typeof aBooking>[0] = {},
): Promise<number> {
  // Each seeded booking gets its own day so the exclusion constraint does not
  // reject the second active booking in a test.
  const offset = slotSequence++ * 3;
  const [row] = await db
    .insert(booking)
    .values(
      aBooking({
        occasionId: 1,
        priceEgp: 2000,
        depositEgp: 1000,
        startsAt: new Date(Date.UTC(2026, 11, 25 + offset, 16, 0, 0)),
        endsAt: new Date(Date.UTC(2026, 11, 25 + offset, 18, 0, 0)),
        ...overrides,
      }),
    )
    .returning({ id: booking.id });
  return row!.id;
}

async function aProof(
  bookingId: number,
  overrides: {
    uploadedAt?: Date;
    receivedVia?: "upload" | "whatsapp";
    filePath?: string | null;
    purgedAt?: Date | null;
  } = {},
): Promise<number> {
  const [row] = await db
    .insert(paymentProof)
    .values({
      bookingId,
      filePath: "filePath" in overrides ? overrides.filePath! : "proofs/x.png",
      receivedVia: overrides.receivedVia ?? "upload",
      uploadedAt: overrides.uploadedAt ?? NOW,
      purgedAt: overrides.purgedAt ?? null,
    })
    .returning({ id: paymentProof.id });
  return row!.id;
}

describe("staff.review.queue", () => {
  it("lists proofs awaiting review after urgent holds, oldest first", async () => {
    await aStoredBooking({
      publicId: "URGENT",
      status: "held",
      urgent: true,
      holdExpiresAt: new Date(NOW.getTime() + 10 * 60_000),
      createdAt: new Date(NOW.getTime() - 30 * 60_000),
    });
    const urgentProof = await aStoredBooking({
      publicId: "URGPROOF",
      status: "proof_submitted",
      urgent: true,
      holdExpiresAt: null,
    });
    await aProof(urgentProof, {
      uploadedAt: new Date(NOW.getTime() - 120 * 60_000),
    });
    const normalProof = await aStoredBooking({
      publicId: "NORMAL",
      status: "proof_submitted",
      urgent: false,
      holdExpiresAt: null,
    });
    await aProof(normalProof, {
      uploadedAt: new Date(NOW.getTime() - 60 * 60_000),
    });
    await aProof(normalProof, {
      uploadedAt: new Date(NOW.getTime() - 10 * 60_000),
    });

    // Excluded: an expired urgent hold, a quiet hold and a decided booking.
    await aStoredBooking({
      publicId: "EXPIRED",
      status: "held",
      urgent: true,
      holdExpiresAt: new Date(NOW.getTime() - 60_000),
    });
    await aStoredBooking({
      publicId: "QUIET",
      status: "held",
      urgent: false,
      holdExpiresAt: new Date(NOW.getTime() + 10 * 60_000),
    });
    await aStoredBooking({
      publicId: "DONE",
      status: "confirmed",
      urgent: true,
      holdExpiresAt: null,
    });

    const result = await ops.queue({}, staff);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.refreshedAt).toBe(NOW.toISOString());
    expect(result.data.items.map((i) => i.bookingId)).toEqual([
      "URGPROOF",
      "URGENT",
      "NORMAL",
    ]);

    const normal = result.data.items.find((i) => i.bookingId === "NORMAL")!;
    // The wait began with the first proof, while the newest proof is the one
    // staff will look at.
    expect(normal.waitingSince).toBe(
      new Date(NOW.getTime() - 60 * 60_000).toISOString(),
    );
    expect(normal.proof?.uploadedAt).toBe(
      new Date(NOW.getTime() - 10 * 60_000).toISOString(),
    );
    expect(normal.proofCount).toBe(2);
    expect(normal.depositEgp).toBe(1000);
    expect(normal.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(normal.start).toBe("18:00");

    const held = result.data.items.find((i) => i.bookingId === "URGENT")!;
    expect(held.status).toBe("held");
    expect(held.waitingSince).toBe(
      new Date(NOW.getTime() - 30 * 60_000).toISOString(),
    );
    expect(held.deadlineAt).toBe(
      new Date(NOW.getTime() + 10 * 60_000).toISOString(),
    );
  });

  it("orders urgent items first, then by longest wait", () => {
    const item = (id: number, urgent: boolean, minutes: number) => ({
      id,
      urgent,
      waitingSince: new Date(NOW.getTime() - minutes * 60_000).toISOString(),
    });
    const ordered = orderReviewQueue([
      item(1, false, 90) as never,
      item(2, true, 20) as never,
      item(3, false, 10) as never,
      item(4, true, 60) as never,
    ]);
    expect(ordered.map((i) => i.id)).toEqual([4, 2, 1, 3]);
  });

  it("refuses anonymous callers", async () => {
    const result = await ops.queue({}, anonymous);
    expect(result.ok ? undefined : result.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("staff.review.get", () => {
  it("returns the booking with proofs newest first and an effective status", async () => {
    const id = await aStoredBooking({
      publicId: "ABC234",
      status: "held",
      holdExpiresAt: new Date(NOW.getTime() - 60_000),
    });
    await aProof(id, { uploadedAt: new Date(NOW.getTime() - 60 * 60_000) });
    await aProof(id, {
      uploadedAt: new Date(NOW.getTime() - 5 * 60_000),
      purgedAt: now,
    });

    const result = await ops.get({ bookingId: "abc-234" }, staff);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      bookingId: "ABC234",
      status: "expired",
      depositEgp: 1000,
      remainderEgp: 1000,
    });
    expect(result.data.proofs).toHaveLength(2);
    expect(result.data.proofs[0]?.uploadedAt).toBe(
      new Date(NOW.getTime() - 5 * 60_000).toISOString(),
    );
    expect(result.data.proofs[0]?.purgedAt).toBe(now.toISOString());
  });

  it("reports an unknown booking as not found", async () => {
    const result = await ops.get({ bookingId: "NOPE12" }, staff);
    expect(result.ok ? undefined : result.error.code).toBe("NOT_FOUND");
  });
});

describe("staff.review.confirm", () => {
  it("makes a submitted proof final and writes one audit row", async () => {
    await aStoredBooking({
      publicId: "CONFIRM",
      status: "proof_submitted",
      holdExpiresAt: null,
    });

    const result = await ops.confirm({ bookingId: "CONFIRM" }, staff);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ bookingId: "CONFIRM", status: "confirmed" });

    const [row] = await db
      .select()
      .from(booking)
      .where(eq(booking.publicId, "CONFIRM"));
    expect(row?.status).toBe("confirmed");
    expect(row?.updatedAt).toEqual(NOW);

    const audit = await db.select().from(auditLog);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorId: "staff-1",
      action: "booking.confirm",
      target: "booking:CONFIRM",
      bookingId: row?.id,
      at: NOW,
      detail: { from: "proof_submitted", to: "confirmed" },
    });
  });

  it("refuses a second decision with the current status and writes nothing", async () => {
    await aStoredBooking({
      publicId: "SECOND",
      status: "proof_submitted",
      holdExpiresAt: null,
    });
    await ops.confirm({ bookingId: "SECOND" }, staff);
    const again = await ops.confirm({ bookingId: "SECOND" }, staff);

    expect(again.ok ? undefined : again.error.code).toBe(
      "BOOKING_STATUS_CHANGED",
    );
    expect(again.ok ? undefined : again.error.details?.status).toBe(
      "confirmed",
    );
    expect(await db.select().from(auditLog)).toHaveLength(1);
  });

  it("refuses a held booking and an unknown one", async () => {
    await aStoredBooking({
      publicId: "HELD12",
      status: "held",
      holdExpiresAt: new Date(NOW.getTime() + 60_000),
    });
    const held = await ops.confirm({ bookingId: "HELD12" }, staff);
    expect(held.ok ? undefined : held.error.code).toBe(
      "BOOKING_STATUS_CHANGED",
    );
    expect(held.ok ? undefined : held.error.details?.status).toBe("held");

    const missing = await ops.confirm({ bookingId: "NOPE12" }, staff);
    expect(missing.ok ? undefined : missing.error.code).toBe("NOT_FOUND");
  });
});

describe("staff.review.reject", () => {
  it("records the reason, frees the slot and audits the decision", async () => {
    const id = await aStoredBooking({
      publicId: "REJECT",
      status: "proof_submitted",
      holdExpiresAt: null,
      startsAt: new Date(Date.UTC(2026, 11, 30, 16, 0, 0)),
      endsAt: new Date(Date.UTC(2026, 11, 30, 18, 0, 0)),
    });

    const result = await ops.reject(
      {
        bookingId: "REJECT",
        reason: "no_transfer",
        note: " Nothing arrived. ",
      },
      staff,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("rejected");

    const [row] = await db.select().from(booking).where(eq(booking.id, id));
    expect(row?.status).toBe("rejected");

    const audit = await db.select().from(auditLog);
    expect(audit[0]).toMatchObject({
      action: "booking.reject",
      detail: {
        from: "proof_submitted",
        to: "rejected",
        reason: "no_transfer",
        note: "Nothing arrived.",
      },
    });

    // The slot is free at once: a new booking on the same range is accepted by
    // the exclusion constraint.
    await expect(
      aStoredBooking({
        publicId: "REFILL",
        status: "confirmed",
        accessToken: "token-refill",
        holdExpiresAt: null,
        startsAt: new Date(Date.UTC(2026, 11, 30, 16, 0, 0)),
        endsAt: new Date(Date.UTC(2026, 11, 30, 18, 0, 0)),
      }),
    ).resolves.toBeGreaterThan(0);
  });

  it("requires a known reason", async () => {
    await aStoredBooking({
      publicId: "REASON",
      status: "proof_submitted",
      holdExpiresAt: null,
    });
    const result = await ops.reject(
      { bookingId: "REASON", reason: "because" as never },
      staff,
    );
    expect(result.ok ? undefined : result.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("staff.review.proofReceived", () => {
  it("records a WhatsApp proof and stops the countdown", async () => {
    const id = await aStoredBooking({
      publicId: "WAPP01",
      status: "held",
      holdExpiresAt: new Date(NOW.getTime() + 20 * 60_000),
    });

    const result = await ops.proofReceived(
      { bookingId: "WAPP01", confirm: false },
      staff,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("proof_submitted");
    expect(result.data.proofId).toBeGreaterThan(0);

    const [proof] = await db
      .select()
      .from(paymentProof)
      .where(eq(paymentProof.bookingId, id));
    expect(proof).toMatchObject({
      receivedVia: "whatsapp",
      filePath: null,
      uploadedAt: NOW,
    });

    const [row] = await db.select().from(booking).where(eq(booking.id, id));
    expect(row?.status).toBe("proof_submitted");
    expect(row?.holdExpiresAt).toBeNull();

    const audit = await db.select().from(auditLog);
    expect(audit[0]).toMatchObject({
      action: "booking.proof_received",
      detail: { via: "whatsapp", confirmed: false },
    });
  });

  it("can confirm in the same step and audits both actions", async () => {
    await aStoredBooking({
      publicId: "WAPP02",
      status: "held",
      holdExpiresAt: new Date(NOW.getTime() + 20 * 60_000),
    });

    const result = await ops.proofReceived(
      { bookingId: "WAPP02", confirm: true },
      staff,
    );
    expect(result.ok ? undefined : result.error.code).toBeUndefined();

    const [row] = await db
      .select()
      .from(booking)
      .where(eq(booking.publicId, "WAPP02"));
    expect(row?.status).toBe("confirmed");

    const audit = await db.select().from(auditLog).orderBy(auditLog.id);
    expect(audit.map((entry) => entry.action)).toEqual([
      "booking.proof_received",
      "booking.confirm",
    ]);
  });

  it("refuses a hold past its deadline and stamps it expired", async () => {
    const id = await aStoredBooking({
      publicId: "LATE01",
      status: "held",
      holdExpiresAt: new Date(NOW.getTime() - 60_000),
    });

    const result = await ops.proofReceived(
      { bookingId: "LATE01", confirm: false },
      staff,
    );
    expect(result.ok ? undefined : result.error.code).toBe(
      "BOOKING_STATUS_CHANGED",
    );
    expect(result.ok ? undefined : result.error.details?.status).toBe(
      "expired",
    );

    const [row] = await db.select().from(booking).where(eq(booking.id, id));
    expect(row?.status).toBe("expired");
    expect(await db.select().from(paymentProof)).toHaveLength(0);
  });

  it("refuses a booking already awaiting review", async () => {
    await aStoredBooking({
      publicId: "AGAIN1",
      status: "proof_submitted",
      holdExpiresAt: null,
    });
    const result = await ops.proofReceived(
      { bookingId: "AGAIN1", confirm: false },
      staff,
    );
    expect(result.ok ? undefined : result.error.code).toBe(
      "BOOKING_STATUS_CHANGED",
    );
  });
});
