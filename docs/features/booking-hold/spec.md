---
id: booking-hold
type: feature
title: Booking Hold
status: shipped
last_modified: 2026-11-20
milestone: v1
pillar: booking
depends_on: [public-calendar, phone-verification, venue-settings, message-delivery]
views: [booking-form]
adrs: [ADR-002, ADR-003, ADR-009, ADR-010, ADR-012, ADR-015, ADR-018, ADR-021, ADR-022]
roadmap_sections: [phase-3-booking/booking-hold]
architecture: [overview, data-model, flows, testing]
components: [web, postgres]
---

# Booking Hold

## Purpose

Turns "I want this slot" into a reservation that is real for 20 minutes. It is the heart of the product's promise: a family can hold a date instantly, no two families can hold the same slot, and a hold nobody pays for disappears on its own.

## Behavior

After choosing a free slot, the customer picks the occasion, enters a name and a phone number, and verifies the phone with a code. The slot is then held: it shows publicly as awaiting payment, and the customer is taken to their private booking page and sent its link.

The hold lasts 20 minutes (a setting). Within that time the customer must upload proof of the deposit transfer; uploading stops the clock. If the deadline passes first, the booking expires and the slot is free again immediately. There is no reminder message and no late-night extension.

Two people can never hold the same slot. If two submit at the same moment, one succeeds and the other is told at once that the slot is being booked by someone else, and may pick another slot or try again later.

For a slot that starts soon, the payment deadline never runs past a set time before the slot starts (the near-slot cutoff). Such bookings are flagged urgent to the owner.

## Data

- **Booking** — public ID, link token, start and end, occasion, customer name and phone, locale, status, source (online), price and deposit as quoted, hold deadline, urgent flag.

The price is the occasion's price at the time of booking; the deposit is the site-wide percentage of it, rounded to whole EGP.

## Surface

- `POST /api/v1/bookings` — date, slot start and end, occasion, name, phone, verified-phone token, locale. Returns booking ID, link token, deadline and deposit; or `409 SLOT_TAKEN`.
- Internal: the tidy-up sweep in the job loop marks overdue holds expired.

## Workflows

**Holding a slot.**

1. Customer selects a free slot, chooses the occasion, enters name and phone.
2. Receives and enters the verification code.
3. The hold is created; the booking page opens with the countdown.
4. A message with the booking link arrives by WhatsApp, or SMS if WhatsApp is unavailable.

**Losing a race.**

1. Customer submits for a slot someone else took seconds earlier.
2. Sees: "This slot is currently being booked by another customer. Choose another slot, or try again later if their booking is not completed."

## Edge cases and constraints

- The no-overlap rule is enforced by a database exclusion constraint, not only by application checks.
- Expiry is by timestamp: a held booking past its deadline is free for every read and write, even if the sweep has not run.
- A phone number may have only one booking in `held` at a time; a second attempt is refused until the first is paid or expires.
- The slot must still exist in the schedule and must not be on a closed date at the moment of the hold.
- If the near-slot cutoff has already passed for a slot, it cannot be held online; the calendar shows the venue's contact instead.
- Funerals follow the same flow as every other occasion, with their own price.
- A double submit of the same form must not create two bookings.

## Open questions

Settled: the near-slot cutoff is 2 hours (120 minutes) and a slot starting within 24 hours (1440 minutes) is flagged urgent; the hold is 20 minutes and the deposit is 50% of the price. All four are settings. A hold's deadline is the earlier of now plus the hold length and the near-slot cutoff, so a hold made close to the slot never outlives the moment it could still be paid for online.

Still open: the 20-minute window is tight for a customer who has to top up a wallet first. Carried from the idea brief as a noted risk; not addressed here.
