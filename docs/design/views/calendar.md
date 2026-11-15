---
id: calendar
type: view
title: Availability Calendar
last_modified: 2026-11-15
feature: public-calendar
mockup: approved
---

# Availability Calendar

## Purpose

The visitor picks a day, sees every slot on it with its state, and chooses a free one to book.

## Layout

> Visual truth: docs/design/mockups/calendar.html

1. **Header** — the same header as the landing page.
2. **Page title** — a "Home" back link, the `h1` and one line of guidance.
3. **Month card** (start side) — previous and next controls around the month name, a seven-column grid starting on Saturday, and a key under the grid. A day with a free slot has a dot under its number; today has a ring; a closed day is struck through; past days are dimmed; the selected day is filled with `brand`.
4. **Day card** (beside the month) — the selected date as heading with a count of free slots, the refreshed indicator, and the slots as a list of pill-shaped rows: time range, state badge, action.
5. **Legend** — the five slot-state badges in one row under both cards.
6. **Contact fallback** — one line with Call and WhatsApp links.

## Components

- Month grid with previous and next month controls and a key
- Day card with slot rows
- State badges (label and icon)
- Legend
- Refreshed indicator
- Contact fallback (phone and WhatsApp)

## States

| State | Description |
|---|---|
| Default | Month shown with today selected, or the first day that has a free slot |
| Loading | First load only: skeleton month and three skeleton slot rows with a spinner and a line of text. A background refresh keeps the previous states |
| Empty | Selected day has no slots or is closed: the day card shows an icon, one sentence, and Call and WhatsApp buttons |
| Error | Availability failed to load: one card replaces the month and day cards, with the message, Retry, Call and WhatsApp |

## Interactions

- Selecting a day shows its slots.
- "Book" on a free slot opens the booking form with date and slot carried over.
- Taken slots show their state and have no action.
- A slot starting sooner than the cutoff shows "Call to book" with icon buttons for Call and WhatsApp in place of "Book".
- Slot states refresh every 30 seconds and on focus.
- Month controls do not go into the past; the previous control is disabled on the current month.

## Responsive behavior

- Below `md`: month card on top, day card below.
- Below `sm`: a slot row becomes a rounded card with time and badge on one line and a full-width action under them.
- `md` and up: month card on the start side, day card beside it.
- `lg` and up: same two columns, capped at 1120px.

## Accessibility

- The month is a grid with row and column headers; arrow keys move between days, Enter selects, Page Up and Page Down change month.
- Each day cell's accessible name includes the date and whether it has free slots, is closed, or has passed.
- Selecting a day moves focus to the day card heading.
- Slot rows are a list; each announces time range and state. Taken slots are not disabled buttons, they are plain list items, so screen readers are not told about an action that does not exist.
- A time range is written start first in the reading direction.
- State changes on refresh are announced politely, once.
