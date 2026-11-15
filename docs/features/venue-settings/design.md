---
id: venue-settings
type: feature-design
title: Venue Settings — Design
last_modified: 2026-11-15
feature: venue-settings
---

# Venue Settings — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Inherits from `docs/design/system.md` at dashboard density. Money and percentage fields are left-to-right with the unit shown inside the field (EGP, %).

## Components

- **Settings tabs** — Occasions, Deposit and payment, Booking rules.
- **Occasions table** — Arabic name, English name, price, active toggle, order controls; Add occasion row.
- **Deposit field** — percentage with a live example: "Wedding: deposit 2,500 EGP".
- **Payment details form** — Vodafone Cash number, InstaPay address.
- **Booking rules form** — hold length, near-slot cutoff, urgent threshold, each with a one-line explanation.
- **Active-holds warning** — shown when payment details are edited while holds are active.

## States

| State | Behavior |
|---|---|
| Empty | No occasions: "Add the occasions the venue can be booked for". No payment method: banner explaining that online booking is off until one is set |
| Loading | Skeleton rows and fields |
| Error | Validation inline on the field; save failure keeps contents and shows the error at the top of the tab |

## Interactions

Each tab saves on its own with a Save button and warns on leaving with unsaved changes. Deactivating an occasion asks for confirmation and explains that existing bookings are unaffected. Changing a price shows the old and new value in the confirmation toast.
