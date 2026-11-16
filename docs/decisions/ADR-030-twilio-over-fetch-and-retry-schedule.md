---
id: ADR-030
type: adr
title: Call Twilio over plain HTTP and give each channel five attempts with growing delays
last_modified: 2026-11-16
decision_status: Accepted
phase_section: phase-2-foundations/message-delivery
mirror_id: ""
counterpart_adrs: []
---

# ADR-030: Call Twilio over plain HTTP and give each channel five attempts with growing delays

## Context

ADR-006 put Twilio behind a messaging adapter and the message-delivery spec left the retry limits open. The adapter needs one call (create a message) and one check (the webhook signature), and the production provider is still undecided.

## Decision

The Twilio adapter calls Twilio's REST API with `fetch` and checks webhook signatures itself (HMAC-SHA1 over the public URL and sorted parameters, compared in constant time); the Twilio SDK is not a dependency. The status callback URL is built from `PUBLIC_BASE_URL`, falling back to `BETTER_AUTH_URL`, because the signature covers the public address and not the one the proxy forwards. Without `MESSAGING_PROVIDER=twilio` a log-only sender is used, so development never sends.

An outbox message gets five failed attempts per channel, waiting 30 seconds, 2 minutes, 10 minutes and 30 minutes between them. When WhatsApp attempts run out, or Twilio reports the WhatsApp message undelivered, the message restarts on SMS with a fresh set of five. When SMS runs out, or reports undelivered, the message is `failed` and logged. A message past its expiry is marked `failed` with the reason `expired` and never sent.

## Rationale

Two calls do not justify a dependency that would have to be replaced with the provider. Five attempts over about 45 minutes ride out a short provider outage without sending a booking link long after its hold expired; messages with a natural expiry carry one.

## Alternatives considered

| Alternative | Why not |
|---|---|
| The `twilio` npm package | Large for two calls and tied to one provider. |
| Retry for hours | A booking link or alert that late is worse than none. |

## Consequences

The schedule is constants in `src/messaging/outbox.ts` and cheap to change. A status callback that arrives before the send call has stored the provider message ID is answered with success and ignored; the message stays `sent`, which is acceptable because only fallback is lost in that rare race.
