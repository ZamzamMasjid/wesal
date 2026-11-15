---
id: booking-management
type: feature
title: Booking Management
status: planned
last_modified: 2026-11-15
milestone: v1
pillar: back-office
depends_on: [staff-access, booking-hold]
views: [bookings]
adrs: [ADR-012, ADR-018]
roadmap_sections: [phase-4-operations/booking-management]
architecture: [data-model, flows, auth, testing]
components: [web, postgres]
---

# Booking Management

## Purpose

Makes the calendar the single record of every booking. Bookings agreed by phone or in person are entered here, so the public calendar never shows a slot as free when it is not. It is also where the offline parts of a booking's life are recorded: cancellation and payment of the remainder.

## Behavior

Staff see all bookings in a list they can filter by date, status and source (online, or entered by staff), and search by name, phone or booking ID. Opening a booking shows its details, proofs and history.

From here staff can:

- **Enter a booking** for a caller or walk-in: pick date, slot and occasion, enter name and phone. It starts confirmed, with no hold and no deposit step in the system.
- **Cancel** a confirmed booking, with a reason. The slot becomes free.
- **Mark the remainder paid** when the customer settles at the venue.

Refunds and the terms of cancellation are agreed by phone under the policy text; the system records only that the booking was cancelled.

## Data

No new entities. Booking fields used here: source, remainder-paid flag, cancellation reason, entered-by staff user.

## Surface

- `GET /api/v1/staff/bookings?from&to&status&source&q`
- `GET /api/v1/staff/bookings/{id}`
- `POST /api/v1/staff/bookings` — manual entry. `409 SLOT_TAKEN` reports who holds the slot and until when.
- `POST /api/v1/staff/bookings/{id}/cancel` — reason required.
- `POST /api/v1/staff/bookings/{id}/remainder-paid`
- `/dashboard/bookings`

## Workflows

**A caller books by phone.**

1. Staff open Add booking, choose the date and slot, the occasion, and enter the caller's name and phone.
2. The booking is saved as confirmed and the public calendar shows the slot as confirmed.

**The slot is held online at that moment.**

1. Staff try to enter a booking for a slot with an active hold.
2. They are told the slot is held and when the hold ends, and can tell the caller to wait or pick another slot.

**The occasion took place.**

1. The customer pays the balance at the venue.
2. Staff mark the remainder paid on the booking.

## Edge cases and constraints

- Manual entries obey the same no-overlap rule as online holds; there is no override.
- A manual entry needs no phone verification; staff vouch for the caller.
- Cancelling is for confirmed bookings. Held and awaiting-review bookings are ended by expiry or rejection.
- The price recorded on a manual booking is the occasion's current price; whether a deposit was taken offline is noted as free text.
- Every entry, cancellation and remainder mark writes an audit row.
- Staff and owner have the same rights here.

## Open questions

- Should a manually entered booking send the customer a link to a booking page, or stay dashboard-only?
- Can staff reschedule a confirmed booking to another slot, or is that cancel plus a new entry?
