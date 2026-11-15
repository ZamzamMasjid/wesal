---
id: slot-alerts
type: feature
title: Slot Alerts
status: planned
last_modified: 2026-11-15
milestone: later
pillar: availability
depends_on: [public-calendar, phone-verification, message-delivery]
views: [slot-alert-signup]
adrs: [ADR-011, ADR-018]
roadmap_sections: [phase-6-alerts-and-reports/slot-alerts]
architecture: [data-model, flows, testing]
components: [web, postgres]
---

# Slot Alerts

## Purpose

"Tell me if this slot frees up." A family that wants a slot which is awaiting payment or awaiting review can ask to be told the moment it becomes free, instead of reloading the calendar.

Deferred from the initial cut: the calendar already shows provisional slots so people can watch them by hand, and alerts depend on phone verification and the outbox, which the first push builds.

## Behavior

On a slot that is awaiting payment or awaiting review, the visitor can tap "Notify me". They enter and verify their phone, and are subscribed to that slot. If the booking on it expires or is rejected, every subscriber receives a WhatsApp or SMS message with a link straight to the booking form for that slot. Being notified reserves nothing: the first subscriber to complete a hold gets the slot.

Subscriptions end when the slot is confirmed, when its start time passes, or after one notification.

## Data

- **Slot alert** — slot time range, phone, locale, created at, notified at.

## Surface

- `POST /api/v1/alerts` — slot, phone, verified-phone token.
- `DELETE /api/v1/alerts/{token}` — unsubscribe link in the message.
- Internal: when a booking becomes `expired` or `rejected`, queue an outbox message per subscriber.

## Workflows

**Subscribing.**

1. Visitor taps "Notify me" on a taken slot and verifies their phone.
2. Sees a confirmation that they will be messaged if it frees up.

**Being notified.**

1. The hold on the slot expires.
2. Subscribers receive a message with a link; the fastest completes a hold, the others see the slot-conflict message.

## Edge cases and constraints

- Confirmed slots do not offer alerts in v1 of this feature; cancellations of confirmed bookings are rare and handled by phone.
- One subscription per phone per slot; a limit on active subscriptions per phone prevents abuse.
- Messages cost money per send; a slot with many subscribers multiplies that.
- Expiry is detected by timestamp, so the notification is sent by the sweep that marks the booking expired. Alerts are therefore as timely as the sweep interval.

## Open questions

- Should alerts also fire when a confirmed booking is cancelled?
- Is there a cap on subscribers per slot?
