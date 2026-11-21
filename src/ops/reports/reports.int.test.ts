// SPEC: booking-reports/spec.md — the owner reads confirmed bookings, income, deposits and remainders by month and occasion, with cancelled bookings and unfinished attempts listed separately
// ROADMAP: phase-6-alerts-and-reports / booking-reports / Implement reports API: bookings and income by month and occasion
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import { booking, occasion } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { aBooking, anOccasion } from "@/test/factories";
import { openTestDb, resetDatabase } from "@/test/db";

import { createReportOperations } from "./reports";

const handle = openTestDb();
const { db } = handle;
const ops = createReportOperations(() => ({ db }));

const NOW = new Date("2026-12-20T08:00:00Z");
const clock: Clock = { now: () => NOW };
const owner = {
  ...createCallContext({ kind: "staff", userId: "owner-1", role: "owner" }),
  clock,
};
const staff = {
  ...createCallContext({ kind: "staff", userId: "staff-1", role: "staff" }),
  clock,
};
const anonymous = { ...createCallContext({ kind: "anonymous" }), clock };

let wedding = 0;
let engagement = 0;

beforeEach(async () => {
  await resetDatabase(handle);
  const [first] = await db
    .insert(occasion)
    .values(anOccasion({ nameAr: "زواج", nameEn: "Wedding" }))
    .returning({ id: occasion.id });
  const [second] = await db
    .insert(occasion)
    .values(anOccasion({ nameAr: "خطوبة", nameEn: "Engagement" }))
    .returning({ id: occasion.id });
  wedding = first?.id ?? 1;
  engagement = second?.id ?? 2;
});
afterAll(() => handle.pool.end());

function at(iso: string) {
  return new Date(iso);
}

async function seed() {
  await db.insert(booking).values([
    aBooking({
      publicId: "NOV1",
      accessToken: "nov-1",
      occasionId: wedding,
      status: "confirmed",
      source: "online",
      startsAt: at("2026-11-05T16:00:00Z"),
      endsAt: at("2026-11-05T18:00:00Z"),
      priceEgp: 1000,
      depositEgp: 500,
      remainderPaid: true,
      holdExpiresAt: null,
    }),
    aBooking({
      publicId: "NOV2",
      accessToken: "nov-2",
      occasionId: engagement,
      status: "confirmed",
      source: "staff",
      startsAt: at("2026-11-20T16:00:00Z"),
      endsAt: at("2026-11-20T18:00:00Z"),
      priceEgp: 2000,
      depositEgp: 0,
      remainderPaid: false,
      holdExpiresAt: null,
    }),
    aBooking({
      publicId: "DEC1",
      accessToken: "dec-1",
      occasionId: wedding,
      status: "confirmed",
      source: "online",
      startsAt: at("2026-12-01T16:00:00Z"),
      endsAt: at("2026-12-01T18:00:00Z"),
      priceEgp: 3000,
      depositEgp: 1500,
      remainderPaid: false,
      holdExpiresAt: null,
    }),
    aBooking({
      publicId: "NOVC",
      accessToken: "nov-c",
      occasionId: wedding,
      status: "cancelled",
      startsAt: at("2026-11-10T16:00:00Z"),
      endsAt: at("2026-11-10T18:00:00Z"),
    }),
    aBooking({
      publicId: "NOVE",
      accessToken: "nov-e",
      occasionId: wedding,
      status: "expired",
      startsAt: at("2026-11-11T16:00:00Z"),
      endsAt: at("2026-11-11T18:00:00Z"),
    }),
    aBooking({
      publicId: "NOVR",
      accessToken: "nov-r",
      occasionId: wedding,
      status: "rejected",
      startsAt: at("2026-11-12T16:00:00Z"),
      endsAt: at("2026-11-12T18:00:00Z"),
    }),
    // Neither a held nor an awaiting-review booking is a confirmed figure.
    aBooking({
      publicId: "NOVH",
      accessToken: "nov-h",
      occasionId: wedding,
      status: "held",
      startsAt: at("2026-11-13T16:00:00Z"),
      endsAt: at("2026-11-13T18:00:00Z"),
    }),
    aBooking({
      publicId: "NOVP",
      accessToken: "nov-p",
      occasionId: wedding,
      status: "proof_submitted",
      startsAt: at("2026-11-14T16:00:00Z"),
      endsAt: at("2026-11-14T18:00:00Z"),
      holdExpiresAt: null,
    }),
  ]);
}

describe("staff.reports.summary", () => {
  it("totals income, deposits, remainders, occasions, months and sources", async () => {
    await seed();

    const result = await ops.summary(
      { from: "2026-11-01", to: "2026-12-31" },
      owner,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      from: "2026-11-01",
      to: "2026-12-31",
      generatedAt: NOW.toISOString(),
      bookings: 3,
      incomeEgp: 6000,
      depositEgp: 2000,
      remainderPaidEgp: 500,
      remainderOutstandingEgp: 3500,
      bySource: { online: 2, staff: 1 },
      cancelled: 1,
      expired: 1,
      rejected: 1,
    });
    expect(result.data.byOccasion).toEqual([
      {
        occasionId: wedding,
        nameAr: "زواج",
        nameEn: "Wedding",
        bookings: 2,
        incomeEgp: 4000,
      },
      {
        occasionId: engagement,
        nameAr: "خطوبة",
        nameEn: "Engagement",
        bookings: 1,
        incomeEgp: 2000,
      },
    ]);
    expect(result.data.byMonth).toEqual([
      { month: "2026-11", bookings: 2, incomeEgp: 3000 },
      { month: "2026-12", bookings: 1, incomeEgp: 3000 },
    ]);
  });

  it("uses Africa/Cairo calendar days at both ends of the period", async () => {
    await db.insert(booking).values([
      // 2026-10-31T22:00Z is 1 November 00:00 in Cairo: inside the period.
      aBooking({
        publicId: "EDGE1",
        accessToken: "edge-1",
        occasionId: wedding,
        status: "confirmed",
        startsAt: at("2026-10-31T22:00:00Z"),
        endsAt: at("2026-11-01T00:00:00Z"),
        priceEgp: 1000,
        depositEgp: 500,
        holdExpiresAt: null,
      }),
      // 2026-12-31T22:00Z is 1 January 00:00 in Cairo: outside the period.
      aBooking({
        publicId: "EDGE2",
        accessToken: "edge-2",
        occasionId: wedding,
        status: "confirmed",
        startsAt: at("2026-12-31T22:00:00Z"),
        endsAt: at("2027-01-01T00:00:00Z"),
        priceEgp: 9000,
        depositEgp: 4500,
        holdExpiresAt: null,
      }),
    ]);

    const result = await ops.summary(
      { from: "2026-11-01", to: "2026-12-31" },
      owner,
    );

    expect(result.ok && result.data.bookings).toBe(1);
    expect(result.ok && result.data.incomeEgp).toBe(1000);
  });

  it("shows a zero month rather than dropping it from a multi-month period", async () => {
    await seed();

    const result = await ops.summary(
      { from: "2026-11-01", to: "2027-01-31" },
      owner,
    );

    expect(result.ok && result.data.byMonth).toEqual([
      { month: "2026-11", bookings: 2, incomeEgp: 3000 },
      { month: "2026-12", bookings: 1, incomeEgp: 3000 },
      { month: "2027-01", bookings: 0, incomeEgp: 0 },
    ]);
  });

  it("is owner-only", async () => {
    await seed();

    const asStaff = await ops.summary(
      { from: "2026-11-01", to: "2026-11-30" },
      staff,
    );
    const asAnonymous = await ops.summary(
      { from: "2026-11-01", to: "2026-11-30" },
      anonymous,
    );

    expect(asStaff).toMatchObject({ ok: false });
    if (!asStaff.ok) expect(asStaff.error.code).toBe("FORBIDDEN");
    expect(asAnonymous).toMatchObject({ ok: false });
    if (!asAnonymous.ok) expect(asAnonymous.error.code).toBe("UNAUTHENTICATED");
  });

  it("validates the period", async () => {
    const bad = async (from: string, to: string) => {
      const result = await ops.summary({ from, to }, owner);
      return result.ok ? undefined : result.error.code;
    };

    expect(await bad("2026-12-31", "2026-11-01")).toBe("VALIDATION_FAILED");
    expect(await bad("2026-02-31", "2026-03-01")).toBe("VALIDATION_FAILED");
  });
});

describe("staff.reports.export", () => {
  it("downloads the same figures as a CSV", async () => {
    await seed();

    const result = await ops.exportReport(
      { from: "2026-11-01", to: "2026-12-31" },
      owner,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.contentType).toBe("text/csv; charset=utf-8");
    expect(result.data.attachment).toBe(true);
    expect(result.data.fileName).toBe(
      "wesal-report-2026-11-01-to-2026-12-31.csv",
    );

    expect(Array.from(result.data.bytes.slice(0, 3))).toEqual([
      0xef, 0xbb, 0xbf,
    ]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      result.data.bytes,
    );
    expect(text.startsWith("\uFEFF")).toBe(true);
    expect(text).toContain(
      "Confirmed bookings,3",
    );
    expect(text).toContain("Income (EGP),6000");
    expect(text).toContain("Occasion,زواج / Wedding,2,4000");
    expect(text).toContain("Month,2026-12,1,3000");
    expect(text).toContain("Source,Online,2");
    expect(text).toContain("Source,Entered by staff,1");
  });

  it("is owner-only", async () => {
    const result = await ops.exportReport(
      { from: "2026-11-01", to: "2026-11-30" },
      staff,
    );

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
