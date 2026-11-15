---
id: ADR-011
type: adr
title: Send verification codes inline and everything else through an outbox
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-2-foundations/message-delivery
mirror_id: ""
counterpart_adrs: []
---

# ADR-011: Send verification codes inline and everything else through an outbox

## Context

Messages are sent through an outside provider that can be slow or down. A customer waiting for a verification code needs it immediately; booking links and staff alerts must not be lost.

## Decision

Verification codes are sent during the request. All other messages are written to an outbox table in the same transaction as the change that causes them and sent by the background loop with retries and SMS fallback.

## Rationale

The customer gets an immediate answer about their code, including an immediate failure (ADR-016). Links and alerts are never lost to a provider hiccup and are never sent for a change that did not commit.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Everything inline | Simplest, but a slow provider slows the request and a failed send is lost. |
| Everything through the outbox | Most resilient, but codes arrive seconds later and the form would have to poll to learn whether delivery failed. |

## Consequences

Delivery is at-least-once, so templates must be harmless to receive twice. Alerts are delayed while the app machine restarts. A delivery-status webhook is needed to trigger SMS fallback.
