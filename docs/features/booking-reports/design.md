---
id: booking-reports
type: feature-design
title: Booking Reports — Design
last_modified: 2026-11-15
feature: booking-reports
---

# Booking Reports — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Inherits from `docs/design/system.md` at dashboard density. Figures use the monospace face and Western digits. Charts are simple bars in `brand` with direct value labels; no chart relies on color alone to distinguish series, and every chart has a table beneath it with the same numbers.

## Components

- **Period picker** — month, range or year, with previous and next.
- **Summary tiles** — confirmed bookings, income, deposits recorded, remainders outstanding.
- **Bookings by occasion** — bar chart and table.
- **Income by month** — bar chart and table, for multi-month periods.
- **Source split** — online versus entered by staff.
- **Not completed** — expired holds and rejected proofs.
- **Export button** — downloads the period's figures.

## States

| State | Behavior |
|---|---|
| Empty | No bookings in the period: tiles show zero and the charts are replaced by "No bookings in this period" |
| Loading | Skeleton tiles and chart areas |
| Error | Inline message with Retry; the period picker stays usable |

## Interactions

Changing the period reloads all figures together. Tapping an occasion's bar opens the bookings list filtered to that occasion and period. Charts mirror for right-to-left: months run from the start side.
