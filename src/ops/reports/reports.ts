import { and, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";

import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { booking, occasion } from "@/db/schema";
import {
  addDays,
  cairoInstant,
  cairoParts,
  isValidDay,
} from "@/lib/cairo-time";
import { addMonths, monthOf } from "@/lib/calendar-grid";
import type { ReportOccasionLine, ReportsSummary } from "@/lib/reports-api";

// Owner reports (docs/features/booking-reports): figures for a period of
// Africa/Cairo calendar days, straight from the bookings table. Income uses the
// price and deposit snapshotted on each booking, so later price changes never
// rewrite history. Cancelled bookings are counted separately and contribute no
// income; expired holds and rejected proofs measure attempts that did not
// complete.

/** A generous ceiling: three years, enough for any comparison the owner needs. */
export const MAX_REPORT_DAYS = 1100;

const day = z
  .string()
  .refine(isValidDay, "Use a real date written YYYY-MM-DD.");

export const reportInput = z
  .object({ from: day, to: day })
  .refine((value) => value.from <= value.to, {
    path: ["to"],
    message: "The end of the range must not be before its start.",
  })
  .refine(
    (value) =>
      Math.round(
        (Date.parse(`${value.to}T00:00:00Z`) -
          Date.parse(`${value.from}T00:00:00Z`)) /
          86_400_000,
      ) <= MAX_REPORT_DAYS,
    {
      path: ["to"],
      message: `Ask for at most ${MAX_REPORT_DAYS} days at a time.`,
    },
  );

export interface ReportDeps {
  db: Database;
}

interface Row {
  status:
    | "held"
    | "proof_submitted"
    | "confirmed"
    | "expired"
    | "rejected"
    | "cancelled";
  source: "online" | "staff";
  occasionId: number;
  startsAt: Date;
  priceEgp: number;
  depositEgp: number;
  remainderPaid: boolean;
  nameAr: string;
  nameEn: string;
}

/** Months covered by the period, in order, so a chart can show zero months. */
function monthsIn(from: string, to: string): string[] {
  const last = monthOf(to);
  const months: string[] = [];
  for (let month = monthOf(from); month <= last; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

/** The figures for `from`..`to`, both Africa/Cairo calendar days. */
export async function buildReports(
  db: Database,
  from: string,
  to: string,
  now: Date,
): Promise<ReportsSummary> {
  const rows: Row[] = await db
    .select({
      status: booking.status,
      source: booking.source,
      occasionId: booking.occasionId,
      startsAt: booking.startsAt,
      priceEgp: booking.priceEgp,
      depositEgp: booking.depositEgp,
      remainderPaid: booking.remainderPaid,
      nameAr: occasion.nameAr,
      nameEn: occasion.nameEn,
    })
    .from(booking)
    .innerJoin(occasion, eq(booking.occasionId, occasion.id))
    .where(
      and(
        gte(booking.startsAt, cairoInstant(from, "00:00")),
        lt(booking.startsAt, cairoInstant(addDays(to, 1), "00:00")),
      ),
    );

  const summary: ReportsSummary = {
    from,
    to,
    generatedAt: now.toISOString(),
    bookings: 0,
    incomeEgp: 0,
    depositEgp: 0,
    remainderPaidEgp: 0,
    remainderOutstandingEgp: 0,
    byOccasion: [],
    byMonth: monthsIn(from, to).map((month) => ({
      month,
      bookings: 0,
      incomeEgp: 0,
    })),
    bySource: { online: 0, staff: 0 },
    cancelled: 0,
    expired: 0,
    rejected: 0,
  };

  const occasions = new Map<number, ReportOccasionLine>();
  const months = new Map(summary.byMonth.map((line) => [line.month, line]));

  for (const row of rows) {
    if (row.status === "expired") {
      summary.expired += 1;
      continue;
    }
    if (row.status === "rejected") {
      summary.rejected += 1;
      continue;
    }
    if (row.status === "cancelled") {
      summary.cancelled += 1;
      continue;
    }
    if (row.status !== "confirmed") continue;

    summary.bookings += 1;
    summary.incomeEgp += row.priceEgp;
    summary.depositEgp += row.depositEgp;
    const remainder = Math.max(0, row.priceEgp - row.depositEgp);
    if (row.remainderPaid) summary.remainderPaidEgp += remainder;
    else summary.remainderOutstandingEgp += remainder;
    summary.bySource[row.source] += 1;

    const line = occasions.get(row.occasionId) ?? {
      occasionId: row.occasionId,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      bookings: 0,
      incomeEgp: 0,
    };
    line.bookings += 1;
    line.incomeEgp += row.priceEgp;
    occasions.set(row.occasionId, line);

    const month = cairoParts(row.startsAt).day.slice(0, 7);
    const monthLine = months.get(month);
    if (monthLine) {
      monthLine.bookings += 1;
      monthLine.incomeEgp += row.priceEgp;
    } else {
      months.set(month, { month, bookings: 1, incomeEgp: row.priceEgp });
    }
  }

  summary.byOccasion = [...occasions.values()].sort(
    (a, b) => b.bookings - a.bookings || a.occasionId - b.occasionId,
  );
  summary.byMonth = [...months.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  return summary;
}

const EXPORT_HEADERS = [
  "Section",
  "Label",
  "Bookings",
  "Income (EGP)",
] as const;

function cell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function line(...values: (string | number)[]): string {
  return values.map(cell).join(",");
}

/** The same figures as `buildReports`, as a UTF-8 CSV with a BOM for Excel. */
export function reportsCsv(summary: ReportsSummary): Uint8Array {
  const rows: string[] = [
    line("Wesal report"),
    line("Period", `${summary.from} to ${summary.to}`),
    line("Generated", summary.generatedAt),
    "",
    line("Summary"),
    line("Confirmed bookings", summary.bookings),
    line("Income (EGP)", summary.incomeEgp),
    line("Deposits recorded (EGP)", summary.depositEgp),
    line("Remainders paid (EGP)", summary.remainderPaidEgp),
    line("Remainders outstanding (EGP)", summary.remainderOutstandingEgp),
    line("Cancelled bookings", summary.cancelled),
    line("Expired holds", summary.expired),
    line("Rejected proofs", summary.rejected),
    "",
    line(...EXPORT_HEADERS),
    ...summary.byOccasion.map((entry) =>
      line(
        "Occasion",
        entry.nameEn ? `${entry.nameAr} / ${entry.nameEn}` : entry.nameAr,
        entry.bookings,
        entry.incomeEgp,
      ),
    ),
    ...summary.byMonth.map((entry) =>
      line("Month", entry.month, entry.bookings, entry.incomeEgp),
    ),
    line("Source", "Online", summary.bySource.online),
    line("Source", "Entered by staff", summary.bySource.staff),
  ];
  return new TextEncoder().encode(`\uFEFF${rows.join("\r\n")}\r\n`);
}

export function createReportOperations(resolve: () => ReportDeps) {
  const summary = defineOperation({
    name: "staff.reports.summary",
    access: "owner",
    input: reportInput,
    handler: async (input, ctx) =>
      buildReports(resolve().db, input.from, input.to, ctx.clock.now()),
  });

  const exportReport = defineOperation({
    name: "staff.reports.export",
    access: "owner",
    input: reportInput,
    handler: async (input, ctx) => {
      const data = await buildReports(
        resolve().db,
        input.from,
        input.to,
        ctx.clock.now(),
      );
      return {
        bytes: reportsCsv(data),
        contentType: "text/csv; charset=utf-8",
        fileName: `wesal-report-${input.from}-to-${input.to}.csv`,
        attachment: true,
        // Figures change as bookings change; never cache an owner's report.
        cacheControl: "private, no-store",
      };
    },
  });

  return { summary, exportReport };
}

export const reportOperations = createReportOperations(() => ({
  db: getDb(),
}));
