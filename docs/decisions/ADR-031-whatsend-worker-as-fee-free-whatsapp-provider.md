---
id: ADR-031
type: adr
title: Use the WhatSend worker as a fee-free WhatsApp provider for now
last_modified: 2026-11-17
decision_status: Accepted
phase_section: phase-2-foundations/message-delivery
mirror_id: ""
counterpart_adrs: []
---

# ADR-031: Use the WhatSend worker as a fee-free WhatsApp provider for now

## Context
Twilio charges per message. Until the venue's volume justifies it, the owner wants to send WhatsApp messages at no cost. The sibling project WhatSend (`C:\Users\zaydo\Projects\whatsend`) already runs a small Node service (`whatsapp-worker`, Baileys) that links to a phone as a WhatsApp Web device and accepts messages over a private HTTP API. ADR-006 keeps the provider behind the `MessageSender` adapter.

## Decision
Add a second adapter, `createWhatSendSender`, selected with `MESSAGING_PROVIDER=whatsend`. It calls the worker's `POST /api/v1/sessions/{id}/messages` with a Bearer secret and a fresh idempotency key, and treats the worker's `202` as accepted. The worker is run separately from WhatSend's `whatsapp-worker` folder and the venue phone is linked once by QR. The adapter sends WhatsApp only: the SMS channel always fails, so no fallback ever reaches a paid channel.

In production the worker is its own Fly app, `wesal-worker`, on a private address with its own volume (DEPLOYMENT.md step 4); the WhatSend worker gained a `WHATSAPP_WORKER_HOST` setting so Fly's private network can reach it.

## Consequences
- No per-message fee and no Twilio account; Twilio stays available by switching the env var.
- This is an unofficial WhatsApp Web integration. WhatsApp can restrict a number that sends automated messages; keep volume to booking codes and links, and use a dedicated venue number.
- The worker must be running and linked. Its `not_connected` rejection is retried with the normal backoff, then the message fails (no SMS fallback).
- "Sent" means the worker accepted the message, not that WhatsApp delivered it; there are no delivery callbacks, so a failed delivery after acceptance is not detected.
- The worker is an extra process to run and back up (its session volume).
