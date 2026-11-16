---
id: venue-settings
type: feature-design
title: Venue Settings — Design
last_modified: 2026-11-16
feature: venue-settings
---

# Venue Settings — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Inherits from `docs/design/system.md` at dashboard density. Money and percentage fields are left-to-right with the unit shown inside the field (EGP, %).

## Components

The page is one scrolling screen with three sections; there are no tabs.

- **Occasions and prices** — one card per occasion: Arabic name, English name, price, a status line ("Offered at 15,000 EGP" or "Not offered"), a Save button and a Deactivate/Activate button. An Add occasion card sits below. Occasions keep creation order; there are no reorder controls in v1.
- **Deposit and booking rules** — deposit percentage, hold length, near-slot cutoff and urgent threshold, each with a one-line explanation where the meaning is not obvious.
- **Payment details** — Vodafone Cash number and InstaPay address, with the always-visible caution about active holds.
- **No-payment banner** — shown above the payment fields when neither method is set.

## States

| State | Behavior |
|---|---|
| Empty | No payment method: banner explaining that online booking is off until one is set |
| Loading | A single "Loading…" line until occasions and settings arrive |
| Error | Validation failures and save failures show one localized notice at the top of the section; the form keeps its contents |

## Interactions

Occasions save one at a time with their own Save button. Deposit, booking rules and payment details save together with one "Save settings" button. Forms do not use browser validation; the server's validation error is shown as the localized notice. Deactivating an occasion asks for confirmation and explains that existing bookings are unaffected; activating needs none. A successful save shows a short confirmation notice.
