---
id: ADR-006
type: adr
title: Send messages through an adapter, with Twilio as the first provider
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-2-foundations/message-delivery
mirror_id: ""
counterpart_adrs: []
---

# ADR-006: Send messages through an adapter, with Twilio as the first provider

## Context

Wesal sends WhatsApp messages with SMS fallback: verification codes, booking links and staff alerts. Provider pricing and sender registration for Egypt have not been checked, and the user wants to test now on a free trial.

## Decision

Define one internal messaging interface. Implement it with a fake sender for development and tests and with Twilio for real sending, using Twilio's trial for testing. The production provider remains open.

## Rationale

The adapter makes the provider a replaceable detail, so testing can start on Twilio's trial without committing to it. The fake sender lets every test run without network calls or cost.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Commit to Twilio for production now | SMS to Egypt is comparatively expensive and needs a registered sender; not yet verified. |
| Meta WhatsApp Cloud API plus a local SMS gateway | Likely cheapest per message, but two integrations and two approvals before anything can be tested. |

## Consequences

Twilio's trial only delivers to verified numbers, enough for testing and not for launch. Choosing and onboarding the production provider (templates, sender registration) is outstanding work before go-live. A push channel can later be added behind the same interface.
