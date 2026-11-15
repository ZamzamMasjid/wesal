---
id: phone-verification
type: feature-design
title: Phone Verification — Design
last_modified: 2026-11-15
feature: phone-verification
---

# Phone Verification — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Inherits from `docs/design/system.md`. The code input is left-to-right in both languages and uses the monospace face at a large size.

## Components

- **Code input** — six boxes, numeric keyboard, `autocomplete="one-time-code"`, paste fills all boxes.
- **Sent-to line** — "We sent a code to" with the phone number and a "Change number" link.
- **Resend control** — disabled with a visible countdown, then active.
- **Delivery-failure panel** — explains that codes cannot be sent right now and shows the venue's phone and WhatsApp buttons.

## States

| State | Behavior |
|---|---|
| Empty | Boxes empty, first box focused |
| Loading | Boxes disabled with a spinner while the code is checked |
| Error | Wrong code: boxes shake once (not with reduced motion), clear, error text with attempts left. Expired or too many attempts: prompt to request a new code. Delivery failed: the delivery-failure panel replaces the input |

## Interactions

The code submits automatically when the sixth digit is entered. Resend sends a new code and restarts the countdown. "Change number" returns to the details form. On success there is no separate success screen: the customer goes straight to the booking page.
