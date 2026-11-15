---
id: reports
type: view
title: Reports
last_modified: 2026-11-15
feature: booking-reports
mockup: none
---

# Reports

## Purpose

The owner reads how many bookings the venue took and what they brought in for a chosen period, by occasion and by month, and exports the figures.

## Layout

```
+--------------------------------------------------+
| Reports      <  November 2026  >   [Month v]  [Export]|
+--------------------------------------------------+
| +----------+ +----------+ +----------+ +---------+|
| | Bookings | | Income   | | Deposits | | Remain. ||
| |    14    | | 92,000   | | 23,000   | | 18,000  ||
| | confirmed| | EGP      | | recorded | | unpaid  ||
| +----------+ +----------+ +----------+ +---------+|
+--------------------------------------------------+
| Bookings by occasion                             |
|  Wedding     ########  6                         |
|  Engagement  ####      3                         |
|  Nikah       ####      3                         |
|  Funeral     ###       2                         |
|  [table with the same numbers and income]        |
+--------------------------------------------------+
| Source: online 9, entered by staff 5             |
| Not completed: 7 expired holds, 1 rejected proof |
+--------------------------------------------------+
```

Figures in the sketch are placeholders.

## Components

- Period picker (month, range, year) with previous and next
- Summary tiles
- Bookings-by-occasion bar chart with table
- Income-by-month bar chart with table (multi-month periods)
- Source split and not-completed lines
- Export button

## States

| State | Description |
|---|---|
| Default | Current month |
| Loading | Skeleton tiles and chart areas |
| Empty | No bookings in the period: tiles show zero, charts replaced by a message |
| Error | Inline message with Retry |

## Interactions

- Changing the period reloads every figure together.
- Tapping an occasion's bar or table row opens Bookings filtered to that occasion and period.
- "Export" downloads the period's figures as a file.

## Responsive behavior

- Below `md`: tiles two across; charts full width; tables scroll horizontally.
- `md` and up: tiles four across; charts and tables side by side where space allows.

## Accessibility

- Every chart has a table with the same data; the chart itself is marked decorative for screen readers and the table carries the information.
- Tiles are a list; each announces its label, value and unit.
- Bars are labelled with their values directly; no information depends on color.
- Month names and number formatting follow the dashboard language; digits are Western in both.
