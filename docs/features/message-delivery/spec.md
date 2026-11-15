---
id: message-delivery
type: feature
title: Message Delivery
status: planned
last_modified: 2026-11-15
milestone: v1
pillar: messaging
depends_on: []
views: []
adrs: [ADR-006, ADR-007, ADR-009, ADR-011, ADR-017, ADR-018, ADR-022, ADR-023]
roadmap_sections: [phase-2-foundations/message-delivery]
architecture: [overview, data-model, flows, testing]
components: [web, postgres]
---

# Message Delivery

## Purpose

Gets automated messages to phones: verification codes and booking links to customers, alerts to owner and staff. WhatsApp is tried first because it is what people here use; SMS is the fallback when WhatsApp cannot deliver. Everything else in the product that needs to send a message does it through this feature.

## Behavior

There are two ways a message is sent:

- **Inline**, for verification codes only. The customer is waiting, so the code is sent during their request and the result is known at once.
- **Through the outbox**, for everything else. The message is recorded together with the change that caused it and sent moments later by a background loop. If sending fails it is retried with increasing delays, and if WhatsApp reports that it could not deliver, the message is sent again by SMS.

Messages are written from templates in Arabic and English and sent in the recipient's language. The provider is hidden behind an adapter: Twilio is the first provider, used on its trial for testing, and a fake sender is used in development and tests. The production provider is still to be chosen.

## Data

- **Outbox message** — recipient, channel, template and its values, locale, status (queued, sent, delivered, failed), attempts, next attempt time, provider message ID, related booking.

## Surface

- Internal: `send(template, recipient, values)` for inline sends; `queue(...)` for outbox sends inside a transaction.
- Internal: the job loop's outbox sender.
- `POST /api/v1/webhooks/twilio/status` — delivery status callbacks, signature-checked.

## Workflows

**Booking link.**

1. A hold is created; in the same transaction a booking-link message is queued.
2. The job loop sends it by WhatsApp within seconds.
3. Twilio reports it undelivered; the loop sends it by SMS.

**Provider outage.**

1. Sends fail; messages stay queued and are retried with backoff.
2. When the provider recovers, queued messages go out. Nothing is lost.

## Edge cases and constraints

- Delivery is at-least-once; a message may occasionally arrive twice, so templates must be harmless to receive twice.
- The job loop runs inside the single app machine. A restart pauses sending for a few minutes; queued messages are sent when it returns.
- A message that keeps failing is marked failed after a maximum number of attempts and logged; with logs as the only monitoring, nobody is alerted.
- Messages older than their usefulness (a booking link for an expired hold) are dropped instead of sent late.
- WhatsApp business messages need pre-approved templates; SMS in Egypt needs a registered sender. Both are setup work outside the code.
- Every message costs money; nothing is sent that a page could show instead.
- The Twilio trial only delivers to verified numbers, which is enough for testing and not for launch.

## Open questions

- Which provider is used in production, and what do Egypt's WhatsApp and SMS rates and sender registration require?
- Maximum attempts and the backoff schedule.
