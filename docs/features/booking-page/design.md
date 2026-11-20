---
id: booking-page
type: feature-design
title: Booking Page — Design
last_modified: 2026-11-20
feature: booking-page
---

# Booking Page — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

The page has one dominant element per status. While held, it is the countdown and the transfer details. Once confirmed, it is a formal confirmation card with the booking details and the remaining balance due at the venue, suitable for showing at the venue. Booking ID, payment numbers, amounts and the countdown use the monospace face and are left-to-right in both languages.

## Components

- **Status header** — status badge and one sentence saying what the customer should do now.
- **Countdown** — minutes and seconds; turns `warning` under five minutes, `danger` under one.
- **Transfer details** — Vodafone Cash number and InstaPay address, each with a copy button, and the deposit amount.
- **Booking summary** — occasion, date, slot, name, booking ID with copy.
- **Upload area** — from `payment-proof`.
- **Confirmation card** — for the confirmed state, with the remaining balance due at the venue.
- **Find my booking form** — a booking ID field, on its own page.

## States

| State | Behavior |
|---|---|
| Empty | Unknown token or ID: "We could not find this booking" with the find-my-booking form and venue contact |
| Loading | Skeleton of the summary; the countdown never shows a placeholder value |
| Error | Status cannot be refreshed: last known status stays, with a "not live" note and Retry |

## Interactions

Copy buttons confirm with a brief inline "Copied". The page polls for status and updates in place; a change from awaiting review to confirmed or rejected is announced to screen readers. When the countdown reaches zero the page switches to the expired state without a reload and offers "Book again".
