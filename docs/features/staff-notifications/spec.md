---
id: staff-notifications
type: feature
title: Staff Notifications
status: planned
last_modified: 2026-11-15
milestone: v1
pillar: messaging
depends_on: [message-delivery, staff-access, payment-proof]
views: []
adrs: [ADR-011, ADR-013, ADR-018]
roadmap_sections: [phase-4-operations/staff-notifications]
architecture: [flows, auth, testing]
components: [web, postgres]
---

# Staff Notifications

## Purpose

Tells the owner and staff that something needs them, so nobody has to keep the dashboard open. The owner's first contact with a customer should be an alert that a payment proof is waiting.

## Behavior

Two events send an alert by WhatsApp, with SMS as fallback:

- **A payment proof was uploaded.** The message gives the occasion, date, slot, customer name and deposit amount, and a link that opens that booking's review page.
- **An urgent hold was created**, for a slot starting soon. The message says the slot is close and to watch for the proof.

The alert carries a link, not the screenshot. The image stays on the server and is seen only after dashboard login.

Each staff member has a notification phone and can turn alerts on or off for themselves. The owner always has at least one recipient set, so a proof never arrives with nobody told.

## Data

No new entities. Uses the staff user's notification phone and opt-in flag, and queues outbox messages.

## Surface

- Internal: queue alerts when a booking enters `proof_submitted`, and when an urgent hold is created.
- `PATCH /api/v1/staff/me/notifications` — phone and opt-in for the current user.
- `PATCH /api/v1/staff/users/{id}` — owner sets these for any staff member.

## Workflows

**A proof arrives in the evening.**

1. Customer uploads the screenshot.
2. Owner's phone shows a WhatsApp message with the booking summary and a link.
3. Owner taps the link, logs in if needed, and lands on the review page.

**A funeral is booked for tomorrow morning.**

1. The hold is flagged urgent; staff receive the urgent alert immediately.
2. The proof alert follows when the customer uploads.

## Edge cases and constraints

- Alerts go through the outbox, so a provider outage delays them and does not lose them. The review queue shows the booking regardless.
- The alert is queued in the same transaction as the status change; an alert is never sent for a change that did not happen.
- Alerts are in each staff member's chosen dashboard language.
- No screenshot, phone number or other detail beyond the summary is put in the message.
- If every staff member has alerts off, the owner's notification phone is used anyway.
- The mark-proof-received action does not send an alert; the person doing it is already looking.

## Open questions

- Should there be a repeat alert if a proof has waited unreviewed for some time?
- Quiet hours: should night-time alerts be held until morning, or always sent?
