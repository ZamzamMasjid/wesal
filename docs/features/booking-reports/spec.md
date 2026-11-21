---
id: booking-reports
type: feature
title: Booking Reports
status: in-progress
last_modified: 2026-11-21
milestone: later
pillar: reporting
depends_on: [booking-management]
views: [reports]
adrs: [ADR-012, ADR-018, ADR-032]
roadmap_sections: [phase-6-alerts-and-reports/booking-reports]
architecture: [data-model, auth, testing]
components: [web, postgres]
---

# Booking Reports

## Purpose

Gives the owner a view of the business: how many bookings the venue takes and how much they bring in, by month and by occasion. Today that picture exists only in the owner's memory and chat history.

Deferred from the initial cut: reports are only meaningful once bookings have accumulated, and the first push is about taking those bookings reliably.

## Behavior

The owner picks a period (a month, a range of months, or a year) and sees:

- The number of confirmed bookings, in total and per occasion.
- Income: the sum of quoted prices of confirmed bookings, split into deposits and remainders marked paid.
- Bookings by source: online versus entered by staff.
- Holds that expired and proofs that were rejected, as a measure of how many attempts do not complete.

Figures can be exported as a spreadsheet file. Reports are for the owner only.

## Data

No new entities. Aggregates bookings by status, occasion, source and month. Income figures use the price and deposit recorded on each booking at the time, so later price changes do not rewrite history.

## Surface

- `GET /api/v1/staff/reports/summary?from&to` — owner only.
- `GET /api/v1/staff/reports/export?from&to` — owner only; file download.
- `/dashboard/reports`

## Workflows

**End of month.**

1. Owner opens Reports; the current month is preselected.
2. Reads totals and the per-occasion breakdown, switches to the previous month to compare.
3. Exports the period for his records.

## Edge cases and constraints

- Deposits are counted as received when a booking is confirmed; the system never sees the actual transfer, so figures reflect what was recorded, not a bank statement.
- Remainders count only when marked paid; unmarked remainders are shown as outstanding.
- Cancelled bookings are excluded from income and listed separately; refunds are handled offline and are not recorded.
- Months are calendar months in Africa/Cairo.
- At this scale the queries run directly on the bookings table; no separate reporting store is needed.
- Staff cannot see reports.

## Open questions

- Should reports show a Hijri month view, given the venue's occasions follow that calendar's seasons?
