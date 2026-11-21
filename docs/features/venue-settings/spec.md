---
id: venue-settings
type: feature
title: Venue Settings
status: shipped
last_modified: 2026-11-21
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

**Booking rules.** The hold length (default 20 minutes), the near-slot cutoff (default 120 minutes), and the urgent threshold (default 1440 minutes). The deposit defaults to 50%. The settings row is created with these defaults the first time it is read.

Changes take effect for new bookings. A booking already made keeps the price and deposit it was quoted.

## Data

- **Occasion** — name in Arabic and English, price in EGP, active flag, display order.
- **Settings** — a single row: deposit percent, hold minutes, near-slot cutoff minutes, urgent threshold, Vodafone Cash number, InstaPay address.

## Surface

- `GET /api/v1/occasions` — public; active occasions with prices.
- `GET /api/v1/staff/occasions`, `POST`, `PATCH /{id}` — owner only.
- `GET /api/v1/staff/settings`, `PUT /api/v1/staff/settings` — owner only; PUT takes every field and an empty payment field means "not set".
- `/dashboard/settings`

Payment details have no public endpoint of their own. They reach a customer only inside the booking-page payload, and only while that booking is held.

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
- Changing the transfer number while holds are active means some customers may have already paid to the old number. The settings screen always shows this caution; showing it only when active holds exist needs the booking table (phase 3).
- Every change writes an audit row with the old and new values.
- Staff cannot see or change settings; they see prices on bookings.

## Open questions

- The defaults below (cutoff 2 hours, urgent within 24 hours, deposit 50%) are starting values the owner can change; confirm them with the venue and with `booking-hold`.
