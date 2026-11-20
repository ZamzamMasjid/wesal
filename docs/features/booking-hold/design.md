---
id: booking-hold
type: feature-design
title: Booking Hold — Design
last_modified: 2026-11-20
feature: booking-hold
---

# Booking Hold — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Plain and focused: no ornament, one column, one decision per step. The chosen slot stays pinned at the top throughout so the customer always sees what they are booking. Tone is neutral, not celebratory, because the same form books funerals.

## Components

- **Slot summary** — date, time range, and a "Change" link back to the calendar.
- **Occasion picker** — radio cards, each with the occasion name and its price.
- **Cost summary** — price, deposit percentage and the deposit amount to transfer now.
- **Details form** — name and phone.
- **What happens next** — three short lines: verify, 20 minutes to transfer, upload the screenshot.
- **Slot-conflict panel** — the message and a "Choose another slot" action.

## States

| State | Behavior |
|---|---|
| Empty | Arrived without a slot: redirected to the calendar |
| Loading | Submit button shows a spinner and is disabled; the form stays visible |
| Error | Field errors inline. Slot taken: the form is replaced by the slot-conflict panel. One held booking already on this phone: message with a link to find that booking |

## Interactions

Choosing an occasion updates the cost summary at once. Submitting moves to the verification code step on the same page. After a successful hold the customer is taken straight to the booking page. The browser back button from the code step returns to the form with its contents kept.
