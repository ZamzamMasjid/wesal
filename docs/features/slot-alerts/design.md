---
id: slot-alerts
type: feature-design
title: Slot Alerts — Design
last_modified: 2026-11-15
feature: slot-alerts
---

# Slot Alerts — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Inherits from `docs/design/system.md`. The "Notify me" action is secondary in weight: it must never look like a way to book the slot.

## Components

- **Notify me action** — on slot cards in the awaiting-payment and awaiting-review states.
- **Signup form** — phone field and the verification code step reused from `phone-verification`.
- **Subscribed confirmation** — states plainly that this reserves nothing.
- **Unsubscribe page** — reached from the link in the message.

## States

| State | Behavior |
|---|---|
| Empty | Not applicable; the action appears only on eligible slots |
| Loading | Submit button spinner while subscribing |
| Error | Already subscribed: shown as success. Limit reached or code delivery failed: inline message with the venue's contact |

## Interactions

Tapping "Notify me" opens the signup form for that slot. After verification the slot card shows "You will be notified" for that visitor's session. The notification's link opens the booking form for the slot directly; if the slot has been taken again by then, the standard slot-conflict message is shown.
