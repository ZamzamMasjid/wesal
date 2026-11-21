import type { ApiEnvelope } from "./api-envelope";

// The browser side of reports (docs/features/booking-reports) and the shapes the
// operation returns. Figures are computed from the bookings table for a period
// of Africa/Cairo calendar days; staff cannot read them, only the owner can.

export interface ReportOccasionLine {
  occasionId: number;
  nameAr: string;
  nameEn: string;
  bookings: number;
  incomeEgp: number;
}

export interface ReportMonthLine {
  /** `YYYY-MM`. */
  month: string;
  bookings: number;
  incomeEgp: number;
}

export interface ReportsSummary {
  /** `YYYY-MM-DD`, Africa/Cairo. */
  from: string;
  /** `YYYY-MM-DD`, Africa/Cairo, inclusive. */
  to: string;
  generatedAt: string;
  /** Confirmed bookings in the period. */
  bookings: number;
  /** Quoted prices of confirmed bookings. */
  incomeEgp: number;
  /** Deposits of confirmed bookings, recorded as received on confirmation. */
  depositEgp: number;
  /** Balances marked paid at the venue. */
  remainderPaidEgp: number;
  /** Balances still owed on confirmed bookings. */
  remainderOutstandingEgp: number;
  byOccasion: ReportOccasionLine[];
  byMonth: ReportMonthLine[];
  bySource: { online: number; staff: number };
  /** Cancelled bookings: excluded from income, listed separately. */
  cancelled: number;
  /** Holds that expired in the period. */
  expired: number;
  /** Proofs rejected in the period. */
  rejected: number;
}

export function reportQuery(from: string, to: string): string {
  return new URLSearchParams({ from, to }).toString();
}

export async function fetchReports(
  from: string,
  to: string,
): Promise<ApiEnvelope<ReportsSummary>> {
  try {
    const response = await fetch(
      `/api/v1/staff/reports/summary?${reportQuery(from, to)}`,
      { headers: { accept: "application/json" } },
    );
    return (await response.json()) as ApiEnvelope<ReportsSummary>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}

/** The export endpoint, opened as a download by the browser. */
export function reportExportHref(from: string, to: string): string {
  return `/api/v1/staff/reports/export?${reportQuery(from, to)}`;
}
