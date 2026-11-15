---
id: venue-settings
type: feature
title: Venue Settings
status: planned
last_modified: 2026-11-15
milestone: v1
pillar: back-office
depends_on: [staff-access]
views: []
adrs: [ADR-012, ADR-018]
roadmap_sections: [phase-2-foundations/venue-settings]
architecture: [data-model, auth, testing]
components: [web, postgres]
---

# Venue Settings

## Purpose

Holds the numbers and details that define a booking at Wesal: which occasions can be booked and what each costs, how big the deposit is, where the deposit is sent, and how long a hold lasts. Only the owner can change them.

## Behavior

**Occasions.** The owner maintains the list of occasions (wedding, engagement, nikah, funeral, and any others), each with an Arabic name, an English name and one price in EGP. The price depends on the occasion only, whatever the slot. An occasion can be deactivated so it is no longer offered without affecting past bookings.

**Deposit.** One site-wide percentage of the occasion price. The deposit amount is calculated for each booking and shown to the customer.

**Payment details.** The Vodafone Cash number and the InstaPay address customers transfer to.

**Booking rules.** The hold length (20 minutes), the near-slot cutoff, and the urgent threshold.

Changes take effect for new bookings. A booking already made keeps the price and deposit it was quoted.

## Data

- **Occasion** — name in Arabic and English, price in EGP, active flag, display order.
- **Settings** — a single row: deposit percent, hold minutes, near-slot cutoff minutes, urgent threshold, Vodafone Cash number, InstaPay address.

## Surface

- `GET /api/v1/occasions` — public; active occasions with prices.
- `GET /api/v1/staff/occasions`, `POST`, `PATCH /{id}` — owner only.
- `GET /api/v1/staff/settings`, `PUT /api/v1/staff/settings` — owner only.
- `GET /api/v1/payment-details` — returned only as part of a booking page, never listed publicly on its own.
- `/dashboard/settings`

## Workflows

**Changing a price.**

1. Owner edits the wedding price and saves.
2. The landing page shows the new price; existing bookings are unchanged.

**Changing the transfer number.**

1. Owner updates the Vodafone Cash number.
2. Booking pages for new and currently held bookings show the new number.

## Edge cases and constraints

- An occasion with bookings cannot be deleted, only deactivated.
- The deposit percentage is between 1 and 100; deposits are rounded to whole EGP.
- At least one payment method must be set before bookings can be taken; until then the calendar shows the venue's contact instead of the booking action.
- Changing the transfer number while holds are active means some customers may have already paid to the old number; the settings screen warns when active holds exist.
- Every change writes an audit row with the old and new values.
- Staff cannot see or change settings; they see prices on bookings.

## Open questions

- Default values for the near-slot cutoff and the urgent threshold (shared with `booking-hold`).
