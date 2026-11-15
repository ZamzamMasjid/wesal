---
id: booking-management
type: feature-design
title: Booking Management — Design
last_modified: 2026-11-15
feature: booking-management
---

# Booking Management — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Inherits from `docs/design/system.md` at dashboard density. Status badges use the same colors and labels as the public calendar so staff and customers speak the same language. Bookings entered by staff carry a small "entered by staff" marker.

## Components

- **Filter bar** — date range, status, source, and a search field for name, phone or booking ID.
- **Bookings table** — date and slot, occasion, customer, status, source, remainder; cards on phones.
- **Booking detail** — summary, proofs, history (audit entries and customer events), actions.
- **Add booking dialog** — date, slot picker showing each slot's state, occasion, name, phone, note.
- **Cancel dialog** — reason, with a reminder that refunds are settled offline.
- **Slot-held notice** — who holds the slot and when the hold ends.

## States

| State | Behavior |
|---|---|
| Empty | No bookings yet: "Bookings will appear here" with Add booking. Filters match nothing: "No bookings match" with Clear filters |
| Loading | Skeleton rows; filters stay usable |
| Error | Slot taken on manual entry: the slot-held notice inside the dialog, form contents kept. Load failure: inline Retry |

## Interactions

The default view is upcoming bookings, soonest first. In the add-booking dialog, taken slots are visible but not selectable, mirroring the public calendar. Cancel and mark-remainder-paid each confirm with a toast and appear in the booking's history at once. Filters are kept in the URL so a filtered view can be bookmarked.
