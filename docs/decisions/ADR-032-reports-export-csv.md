---
id: ADR-032
type: adr
title: Export reports as a UTF-8 CSV file
last_modified: 2026-11-21
decision_status: Accepted
phase_section: phase-6-alerts-and-reports/booking-reports
mirror_id: ""
counterpart_adrs: []
---

# ADR-032: Export reports as a UTF-8 CSV file

## Context
The owner wants the period's figures for his records. The feature spec leaves the format open (Excel or CSV), and the app has no spreadsheet library. The export contains Arabic occasion names, so Excel on Windows has to read the file in the right encoding.

## Decision
Export CSV, served as a download with `text/csv; charset=utf-8`, a UTF-8 byte-order mark and CRLF line endings. One file carries the summary, the by-occasion and by-month tables, and the source split; Arabic names appear beside their English ones in one cell.

## Alternatives considered

| Alternative | Why not |
|---|---|
| XLSX with a library such as `exceljs` | Nicer formatting and column widths, but a new dependency and a writer to maintain for a few figures the owner reads once a month. |
| CSV without a BOM | Opens as mojibake in Excel on Windows, which is the likeliest place the owner opens it. |
| PDF | Printable but not sortable or reusable in a spreadsheet. |

## Consequences
- Excel, Numbers, LibreOffice and any script can read the file; the BOM makes Arabic names display correctly on Windows.
- The file is plain text with no styling, formulas or charts.
- Every export is built fresh from the bookings table; nothing is stored.
