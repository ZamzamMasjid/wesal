---
id: ADR-034
type: adr
title: Send staff push through Expo and fall back to WhatsApp
last_modified: 2026-11-21
decision_status: Accepted
phase_section: phase-7-mobile-app/push-notifications
mirror_id: ""
counterpart_adrs: []
---

# ADR-034: Send staff push through Expo and fall back to WhatsApp

## Context
Staff alerts already go through the outbox as WhatsApp messages (ADR-006, ADR-011). The mobile app adds a free, lock-screen channel: Expo push. The feature spec requires each staff member to choose push, WhatsApp or both, and requires an alert that cannot reach any of a person's devices to fall back to WhatsApp rather than vanish.

## Decision
Register devices at `POST /api/v1/staff/devices` and keep them in a `staff_device` table (user, Expo push token, platform, active). Add `staff_user.alert_channel` (`push`, `whatsapp`, `both`, default `whatsapp`). When a staff alert is queued, one **per-person** push row is written for push users, addressed by staff user id; the push sender resolves that person's active devices at send time and fans out to all of them. One accepted ticket counts as delivered. The outbox retries push like any other channel; when the last attempt fails, the row is marked failed and a WhatsApp staff alert is queued for the same person, so the message is not lost. Expo tokens reported as `DeviceNotRegistered` are deactivated.

## Alternatives considered

| Alternative | Why not |
|---|---|
| One outbox row per device | A person's alerts are then retried and fall back independently, so a dead phone could trigger a duplicate WhatsApp message while another phone received the push. |
| Firebase Cloud Messaging directly | Another service and two platform integrations; Expo wraps both stores' push services with one token. |
| Push inside the request that uploads the proof | Delivery would share the customer's request latency, with no outbox retries. |
| WhatsApp only | Already works, but costs money per message and disappears among chats; push is free and visible on the lock screen. |

## Consequences
- Push tokens are device secrets; they are never shown to another user, and logout removes the registration.
- The fallback duplicates the message only if a person chose "both"; that is what "both" means.
- Push credentials (`EXPO_ACCESS_TOKEN`) and store accounts are deployment setup; without them the provider logs instead of sending, like the messaging log sender.
- Push text carries the booking summary and a review link, never the screenshot (ADR-013).
