---
id: payment-review
type: feature
title: Payment Review
status: planned
last_modified: 2026-11-15
milestone: v1
pillar: back-office
depends_on: [staff-access, payment-proof]
views: [review-queue]
adrs: [ADR-013, ADR-018, ADR-019]
roadmap_sections: [phase-4-operations/payment-review]
architecture: [flows, auth, data-model, testing]
components: [web, postgres, upload-volume]
---

# Payment Review

## Purpose

The owner's decision point. A booking becomes final only when a person has checked that the deposit actually arrived. This feature puts every proof waiting for that check in one place and makes confirming or rejecting a single deliberate action.

## Behavior

The review queue lists bookings awaiting review, oldest first, with urgent ones (slots starting soon) on top. Opening one shows the booking details, the expected deposit amount, and the screenshot at full size. The reviewer checks their Vodafone Cash or InstaPay for the transfer and then:

- **Confirms** — the booking is final and the slot shows as confirmed. The customer's booking page updates.
- **Rejects** — with a reason (wrong amount, unreadable image, no transfer found). The slot becomes free at once and the customer starts again like anyone else.

When a customer sent the screenshot over WhatsApp instead of uploading it, staff open the held booking and choose **mark proof received**. That stops its countdown and places it in the queue; they can then confirm in the same step.

A staff alert's link opens the booking's review page directly, after login if needed.

## Data

No entities of its own. Changes booking status, reads payment proofs, writes audit rows.

## Surface

- `GET /api/v1/staff/review-queue` — bookings in `proof_submitted`, plus urgent `held` bookings for visibility.
- `POST /api/v1/staff/bookings/{id}/confirm`
- `POST /api/v1/staff/bookings/{id}/reject` — reason required.
- `POST /api/v1/staff/bookings/{id}/proof-received` — for proofs sent over WhatsApp.
- `/dashboard/review`, `/dashboard/review/{bookingId}`

## Workflows

**Confirming from an alert.**

1. Owner receives a WhatsApp alert and taps the link.
2. Sees the booking and screenshot, checks the wallet, taps Confirm and confirms the dialog.
3. The queue shows the next item, or the empty state.

**Rejecting.**

1. Reviewer finds no matching transfer, taps Reject, picks a reason.
2. The slot is free immediately; the customer's page shows the rejection and how to book again.

## Edge cases and constraints

- Two staff acting on the same booking: the second action is refused with the current status; nothing is applied twice.
- Confirm and reject are single actions with a confirmation dialog; there are no bulk actions.
- A proof waits without a timer. How long a slot stays locked depends on how fast it is reviewed; the queue shows how long each has waited.
- Screenshots are visible only to logged-in staff and are deleted after one day; a purged proof shows as "screenshot no longer available".
- Whether the customer is messaged on confirm or reject is not decided; the booking page always shows the outcome.
- Every decision writes an audit row with the reviewer and time.

## Open questions

- Should the customer receive a WhatsApp or SMS message on confirmation and on rejection? The interview covered codes, links and staff alerts only.
