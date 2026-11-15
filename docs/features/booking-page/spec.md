---
id: booking-page
type: feature
title: Booking Page
status: planned
last_modified: 2026-11-15
milestone: v1
pillar: booking
depends_on: [booking-hold]
views: [booking-status]
adrs: [ADR-012, ADR-018]
roadmap_sections: [phase-3-booking/booking-page]
architecture: [auth, data-model, testing]
components: [web, postgres]
---

# Booking Page

## Purpose

The customer's private page for one booking. It tells them exactly how to pay, how long they have, and where their booking stands, without an account or a password. It is the page they return to after making the transfer, and the proof they can show on the day.

## Behavior

The page is reached by the link sent over WhatsApp or SMS, or by typing the booking ID on the site. It shows:

- The occasion, date and slot, and the customer's name.
- While held: the Vodafone Cash number and InstaPay address, the deposit amount, the booking ID, and a countdown to the deadline, with the upload action (see `payment-proof`).
- After proof is sent: "awaiting review", with the countdown gone.
- When confirmed: a confirmation with the booking details and the remaining balance to be paid at the venue.
- When rejected, expired or cancelled: what happened and a link to book again.

The page refreshes its status on its own, so a customer waiting for confirmation sees it without reloading.

## Data

No entities of its own. Reads one booking and the payment details and policy from settings and content.

## Surface

- `GET /b/{token}` — the page.
- `GET /api/v1/bookings/by-token/{token}` — the booking as its holder may see it.
- `GET /api/v1/bookings/lookup?bookingId=` — returns the link token for a matching ID; rate-limited.

## Workflows

**Paying after holding.**

1. Customer lands on the page straight after verification and sees the transfer details and countdown.
2. Switches to their wallet app, transfers the deposit, returns by the link in WhatsApp.
3. Uploads the screenshot; the page changes to awaiting review.

**Coming back later.**

1. Customer lost the link; opens the site, chooses "Find my booking" and types the booking ID.
2. Is taken to the booking page.

## Edge cases and constraints

- Lookup by phone number does not exist; it would expose a family's booking to anyone who knows their number.
- Booking IDs are random and short enough to read over the phone; lookup is rate-limited and gives the same answer for wrong and nonexistent IDs.
- The countdown is computed from the server's deadline, never from when the page loaded.
- The link token is the customer's key: the page reminds them not to share it publicly.
- Payment numbers are copyable with one tap and shown left-to-right in both languages.
- The holder cannot cancel or edit the booking here; the page shows the venue's contact for that.

## Open questions

- Booking ID format: length and alphabet (for example `W-` plus eight unambiguous characters).
