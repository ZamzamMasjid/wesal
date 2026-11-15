---
id: bookings
type: view
title: Bookings
last_modified: 2026-11-15
feature: booking-management
mockup: none
---

# Bookings

## Purpose

Staff see every booking, find one quickly, enter phone and walk-in bookings, cancel, and mark the remainder paid.

## Layout

```
+--------------------------------------------------+
| Bookings                         [ + Add booking ]|
+--------------------------------------------------+
| [search name / phone / ID]                       |
| Dates [upcoming v]  Status [all v]  Source [all v]|
+--------------------------------------------------+
| Date / slot     Occasion  Customer  Status   Rem.|
| Sat 5 Dec 2:00  Wedding   ...       Confirmed  - |
| Sat 5 Dec 4:30  Nikah     ...       Awaiting   - |
|                                     review       |
| Fri 11 Dec 7:30 Engagem.  ... (staff) Confirmed paid|
| ...                                              |
+--------------------------------------------------+
| < Previous                              Next >   |
+--------------------------------------------------+

Booking detail (side panel on desktop, page on phones)
+--------------------------------------------------+
| W-7K3M9QXT            Confirmed                  |
| Wedding, Sat 5 Dec, 2:00 - 4:00 pm               |
| Name, phone [call]   Source: online              |
| Price 10,000   Deposit 2,500   Remainder: unpaid |
+--------------------------------------------------+
| Proofs: [thumbnail]                              |
+--------------------------------------------------+
| History                                          |
|  12:01 held (customer)                           |
|  12:09 proof uploaded (customer)                 |
|  12:30 confirmed by Ahmed                        |
+--------------------------------------------------+
| [ Mark remainder paid ]   [ Cancel booking ]     |
+--------------------------------------------------+
```

## Components

- Filter bar and search
- Bookings table (cards on phones)
- Status badges
- Booking detail panel with history
- Add booking dialog with slot picker
- Cancel dialog
- Slot-held notice

## States

| State | Description |
|---|---|
| Default | Upcoming bookings, soonest first |
| Loading | Skeleton rows; filters usable |
| Empty | No bookings yet, with Add booking; or no matches, with Clear filters |
| Error | Load failure with Retry; slot taken during manual entry shows the slot-held notice in the dialog |

## Interactions

- Selecting a row opens the detail.
- "Add booking" opens the dialog: date, slot (taken slots visible, not selectable), occasion, name, phone, note; saving creates a confirmed booking.
- "Cancel booking" asks for a reason and frees the slot.
- "Mark remainder paid" toggles the flag after a confirmation.
- A held booking's detail offers "Mark proof received".
- Filters and search update the URL.

## Responsive behavior

- Below `md`: cards instead of a table; filters collapse behind a Filters button; detail is a full page.
- `md` to `lg`: table with the detail as an overlay panel.
- `lg` and up: table with the detail panel beside it.

## Accessibility

- The table has a caption and column headers; rows are reachable by keyboard and open with Enter.
- Status is text in every row, not only a colored badge.
- The detail panel is a labelled region; opening it moves focus to its heading and closing returns focus to the row.
- History is an ordered list with times in the dashboard language.
