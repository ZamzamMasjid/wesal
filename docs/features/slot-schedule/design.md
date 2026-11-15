---
id: slot-schedule
type: feature-design
title: Slot Schedule — Design
last_modified: 2026-11-15
feature: slot-schedule
---

# Slot Schedule — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Inherits from `docs/design/system.md` at dashboard density. The week starts on Saturday. Times are shown in 12-hour form with Arabic or English day-period markers, and time inputs are left-to-right in both languages.

## Components

- **Weekly grid** — seven day columns (stacked as an accordion on phones), each listing its slots as chips with start and end.
- **Slot editor** — two time pickers and a remove button; inline overlap error.
- **Copy day** — copy one weekday's slots to others.
- **Exceptions list** — upcoming date exceptions, each marked "closed" or "custom slots".
- **Exception dialog** — date picker, closed toggle, optional note, slot editor when not closed.
- **Conflict panel** — lists the bookings that block an edit, each linking to the booking.

## States

| State | Behavior |
|---|---|
| Empty | No pattern yet: "Add the times the venue can be booked" with an Add slot action on each day |
| Loading | Skeleton grid |
| Error | Validation errors inline on the offending slot; conflict with existing bookings shown in the conflict panel, nothing saved |

## Interactions

The weekly pattern is edited as a whole and saved with one Save button. Exceptions are created and removed individually and take effect at once. Blocking a date is the exception dialog with "closed" preselected, reachable in one tap from the exceptions list.
