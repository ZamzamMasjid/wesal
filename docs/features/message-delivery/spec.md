---
id: message-delivery
type: feature
title: Message Delivery
status: shipped
last_modified: 2026-11-21
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
- **Through the outbox**, for everything else. The message is recorded together with the change that caused it and sent moments later by a background loop. If sending fails it is retried with increasing delays, and in Twilio mode, if WhatsApp reports that it could not deliver, the message is sent again by SMS.

Messages are written from templates in Arabic and English and sent in the recipient's language. The provider is hidden behind an adapter and chosen by `MESSAGING_PROVIDER` (ADR-006, ADR-031): `twilio` sends WhatsApp with an SMS fallback and reports delivery by callback; `whatsend` sends through the fee-free WhatSend worker by WhatsApp only, with no SMS fallback and no callbacks; without a provider, and in tests, a log-only sender is used. Channel capability belongs to the provider, so the SMS sentences below apply to Twilio mode.

## Data

- **Outbox message** — recipient, channel, template and its values, locale, status (queued, sent, delivered, failed), attempts, next attempt time, expiry, provider message ID, last error, related booking. `channel` is the channel the next attempt uses; switching channel changes it, and a fallback exists only when the provider offers the second channel.

## Surface

- Internal: `sendInline({ sender, logger }, { template, recipient, values, locale })` for inline sends (the provider's channels; throws `MessageDeliveryError` when every channel it offers fails); `queueMessage(tx, clock, { template, recipient, values, locale, bookingId?, expiresAt? })` for outbox sends inside a transaction. Values are validated against the template before anything is written.
- Internal: `MessageSender` (`src/messaging/sender.ts`), implemented by Twilio (`src/messaging/twilio.ts`), the WhatSend worker (`src/messaging/whatsend.ts`), a log-only sender for development, and the recording fake in `src/test/`. `MESSAGING_PROVIDER=twilio` selects Twilio, `whatsend` selects the worker and requires `WHATSEND_WORKER_URL`, `WHATSEND_WORKER_SECRET` and `WHATSEND_SESSION_ID`; anything else only logs.
- Internal: the job loop (`src/jobs/loop.ts`, started from `src/instrumentation.ts`; `JOBS=off` disables it) and its outbox sender `processOutbox`.
- Templates: `code`, `booking-link`, `staff-alert` (kind `proof` or `urgent`; a link to the review page, never the screenshot), each in Arabic and English, times shown in Africa/Cairo.
- `POST /api/v1/webhooks/twilio/status` — delivery status callbacks, Twilio mode only (form-encoded, `X-Twilio-Signature` checked against the auth token and the public URL). Answers `FORBIDDEN` for a bad signature and success for any signed call, including an unknown message, so Twilio does not retry. `delivered`/`read` mark the message delivered; `undelivered`/`failed` send a WhatsApp message again by SMS, or mark an SMS failed. The WhatSend worker sends no callbacks.

## Workflows

**Booking link.**

1. A hold is created; in the same transaction a booking-link message is queued.
2. The job loop sends it by WhatsApp within seconds.
3. In Twilio mode, Twilio reports it undelivered; the loop sends it by SMS. In WhatSend mode there is no callback and no fallback: the message is treated as sent when the worker accepts it.

**Provider outage.**

1. Sends fail; messages stay queued and are retried with backoff.
2. When the provider recovers, queued messages go out. Nothing is lost.
3. With the WhatSend worker, a dropped WhatsApp link looks like an outage until the session is re-linked; the app's health check reports the worker's session state.

## Edge cases and constraints

- Delivery is at-least-once; a message may occasionally arrive twice, so templates must be harmless to receive twice.
- The job loop runs inside the single app machine. A restart pauses sending for a few minutes; queued messages are sent when it returns.
- Each channel gets five attempts, waiting 30 seconds, 2 minutes, 10 minutes and 30 minutes between them (ADR-030). In Twilio mode, when WhatsApp attempts run out the message restarts on SMS; with the WhatSend worker there is no second channel, so it is marked failed. When SMS attempts run out it is marked failed and logged. With logs as the only monitoring, nobody is alerted.
- A claimed message is not claimed again for two minutes, so overlapping job runs never send it twice at once; a run that crashes mid-send is retried after that.
- A status callback that arrives before the send call has stored the provider message ID is ignored; the worker has no status callbacks.
- Messages older than their usefulness (a booking link for an expired hold) are dropped instead of sent late: a message queued with an expiry that has passed is marked failed with the reason `expired`.
- In Twilio mode, WhatsApp business messages need pre-approved templates and SMS in Egypt needs a registered sender. The WhatSend worker sends as the linked phone, so it skips template approval but carries WhatsApp's risk of restricting an automated number (ADR-031).
- Twilio charges per message; the WhatSend worker is free per message. Either way, nothing is sent that a page could show instead.
- The Twilio trial only delivers to verified numbers, which is enough for testing and not for launch. The WhatSend worker has no trial; it reaches any number the linked phone can message.

## Open questions

- Whether the WhatSend worker stays the production provider at launch or Twilio's paid plan takes over remains an owner decision; the cost and sender-registration numbers (Egypt WhatsApp and SMS rates) are not yet collected. ADR-031 records WhatSend as the current choice.
