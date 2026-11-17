---
id: message-delivery
type: feature
title: Message Delivery
status: shipped
last_modified: 2026-11-16
milestone: v1
pillar: messaging
depends_on: []
views: []
adrs: [ADR-006, ADR-007, ADR-009, ADR-011, ADR-017, ADR-018, ADR-022, ADR-023, ADR-030, ADR-031]
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

- **Outbox message** — recipient, channel, template and its values, locale, status (queued, sent, delivered, failed), attempts, next attempt time, expiry, provider message ID, last error, related booking. `channel` is the channel the next attempt uses; falling back to SMS changes it.

## Surface

- Internal: `sendInline({ sender, logger }, { template, recipient, values, locale })` for inline sends (WhatsApp, then SMS at once; throws `MessageDeliveryError` when both fail); `queueMessage(tx, clock, { template, recipient, values, locale, bookingId?, expiresAt? })` for outbox sends inside a transaction. Values are validated against the template before anything is written.
- Internal: `MessageSender` (`src/messaging/sender.ts`), implemented by Twilio, a log-only sender for development, and the recording fake in `src/test/`. `MESSAGING_PROVIDER=twilio` selects Twilio; anything else only logs.
- Internal: the job loop (`src/jobs/loop.ts`, started from `src/instrumentation.ts`; `JOBS=off` disables it) and its outbox sender `processOutbox`.
- Templates: `code`, `booking-link`, `staff-alert` (kind `proof` or `urgent`; a link to the review page, never the screenshot), each in Arabic and English, times shown in Africa/Cairo.
- `POST /api/v1/webhooks/twilio/status` — delivery status callbacks (form-encoded, `X-Twilio-Signature` checked against the auth token and the public URL). Answers `FORBIDDEN` for a bad signature and success for any signed call, including an unknown message, so Twilio does not retry. `delivered`/`read` mark the message delivered; `undelivered`/`failed` send a WhatsApp message again by SMS, or mark an SMS failed.

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
- Each channel gets five attempts, waiting 30 seconds, 2 minutes, 10 minutes and 30 minutes between them (ADR-030). When WhatsApp attempts run out the message restarts on SMS; when SMS attempts run out it is marked failed and logged. With logs as the only monitoring, nobody is alerted.
- A claimed message is not claimed again for two minutes, so overlapping job runs never send it twice at once; a run that crashes mid-send is retried after that.
- A status callback that arrives before the send call has stored the provider message ID is ignored.
- Messages older than their usefulness (a booking link for an expired hold) are dropped instead of sent late: a message queued with an expiry that has passed is marked failed with the reason `expired`.
- WhatsApp business messages need pre-approved templates; SMS in Egypt needs a registered sender. Both are setup work outside the code.
- Every message costs money; nothing is sent that a page could show instead.
- The Twilio trial only delivers to verified numbers, which is enough for testing and not for launch.

## Open questions

- Which provider is used in production, and what do Egypt's WhatsApp and SMS rates and sender registration require?
