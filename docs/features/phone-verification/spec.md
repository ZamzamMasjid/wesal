---
id: phone-verification
type: feature
title: Phone Verification
status: shipped
last_modified: 2026-11-21
milestone: v1
pillar: booking
depends_on: [message-delivery]
views: []
adrs: [ADR-011, ADR-016, ADR-018, ADR-031]
roadmap_sections: [phase-2-foundations/phone-verification]
architecture: [auth, flows, testing]
components: [web, postgres]
---

# Phone Verification

## Purpose

Proves that a customer controls the phone number they entered before any slot is held for them. It is the protection against someone filling the calendar with fake holds, and it guarantees the booking link reaches a real phone.

## Behavior

When the customer submits the booking form, a six-digit code is sent to their phone by WhatsApp. With the Twilio provider an SMS is attempted when WhatsApp cannot deliver; with the WhatSend worker there is no SMS channel, so a WhatsApp failure is final (ADR-031). They enter the code; if it matches, the hold is created. The code is valid for five minutes and for five attempts. The customer can ask for a new code after 60 seconds.

If the code cannot be delivered on any channel the provider offers, no hold is created. The page says codes cannot be sent right now and shows the venue's phone number and WhatsApp so the booking can be made by contacting the owner.

Verification creates no account and no login; it proves control of the phone once.

## Data

- **Phone verification** — phone, hashed code, expiry, attempts, created at.

A successful check issues a short-lived verified-phone token bound to that phone number and valid for ten minutes.

## Surface

- `POST /api/v1/verification/request` — phone, locale. Sends the code inline. Errors: `RATE_LIMITED`, `CODE_DELIVERY_FAILED` (with venue contact).
- `POST /api/v1/verification/check` — phone, code. Returns the verified-phone token. Errors: `CODE_INVALID`, `CODE_EXPIRED`, `TOO_MANY_ATTEMPTS`.

## Workflows

**Verifying.**

1. Customer submits name and phone; the code step appears.
2. The code arrives; on phones that support it, it is offered for autofill.
3. Customer enters it; the hold is created and the booking page opens.

**Code never arrives.**

1. Customer waits out the resend timer and requests a new code.
2. If delivery itself failed, they see the venue's contact details instead of a code field.

## Edge cases and constraints

- The code is sent during the request, not through the outbox, because the customer is waiting for it.
- Requests are rate-limited per phone (one per 60 seconds, five per hour) and per IP (twenty per hour); codes are stored hashed and compared in constant time.
- A token is accepted only for the phone it was issued to and only until it expires.
- Egyptian numbers are the expected case; the country code is prefilled. Other countries are accepted if the provider can deliver.
- Each code costs a message fee; rate limits also bound that cost.
- Messages are in the language the customer is browsing in.

