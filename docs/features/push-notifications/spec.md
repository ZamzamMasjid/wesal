---
id: push-notifications
type: feature
title: Push Notifications
status: planned
last_modified: 2026-11-15
milestone: later
pillar: mobile-app
depends_on: [customer-mobile-app, staff-notifications]
views: []
adrs: [ADR-006, ADR-018]
roadmap_sections: [phase-7-mobile-app/push-notifications]
architecture: [overview, flows, testing]
components: [web, postgres]
---

# Push Notifications

## Purpose

Delivers staff alerts as push notifications on the owner's and staff's phones through the mobile app. Push is free per message and arrives on the lock screen, where a WhatsApp alert costs money and sits among other chats.

Deferred from the initial cut: push needs the mobile app to exist, and WhatsApp alerts already cover the need in the first push.

## Behavior

A staff member who is logged in to the mobile app receives the same two alerts as in `staff-notifications` as push notifications: a payment proof is waiting, and an urgent hold was created. Tapping the notification opens that booking's review screen in the app.

Each staff member chooses how they are alerted: push, WhatsApp, or both. If push cannot be delivered to any of a person's devices, the alert falls back to WhatsApp so it is never silently dropped.

Customers do not receive push notifications in this feature.

## Data

- **Device registration** — staff user, push token, platform, last seen.

## Surface

- `POST /api/v1/staff/devices` — register the device's push token after login.
- `DELETE /api/v1/staff/devices/{id}` — on logout.
- Internal: a push sender behind the messaging adapter, used by the outbox like any other channel.

## Workflows

**Alert by push.**

1. A customer uploads proof; the alert is queued.
2. The job loop sends it as push to the owner's registered devices.
3. Owner taps it and lands on the review screen.

**Push unavailable.**

1. The owner's token is no longer valid.
2. The alert is sent by WhatsApp and the stale device registration is removed.

## Edge cases and constraints

- Push goes through the same outbox and retry rules as other messages.
- Logging out or disabling a staff account removes its device registrations.
- Notification text carries the booking summary only, as with WhatsApp alerts; no screenshot.
- Push delivery is best-effort on both platforms; the WhatsApp fallback is what makes alerts dependable.
- Requires push credentials for Android and iOS, set up outside the code.

## Open questions

- Should customers get a push when their booking is confirmed or rejected? Tied to the open question in `payment-review`.
