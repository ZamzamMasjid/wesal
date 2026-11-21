---
id: customer-mobile-app
type: feature
title: Customer Mobile App
status: in-progress
last_modified: 2026-11-21
milestone: later
pillar: mobile-app
depends_on: [public-calendar, booking-hold, booking-page, payment-proof]
views: [mobile-home]
adrs: [ADR-012, ADR-018, ADR-033]
roadmap_sections: [phase-7-mobile-app/customer-mobile-app]
architecture: [overview, auth, testing]
components: [web]
---

# Customer Mobile App

## Purpose

The same booking experience as the website, as an installable app for Android and iOS. It gives returning families and the venue's community a permanent icon for Wesal and is the base for push notifications to owner and staff.

Deferred from the initial cut: the web app comes first by the owner's decision, and the app adds reach, not new capability. It is cheap to add later because the web UI already runs on the versioned JSON API the app will use.

## Behavior

The app offers what the public website offers: the venue's description, photos and prices; the availability calendar; holding a slot with phone verification; the private booking page with transfer details and countdown; and uploading the payment screenshot from the phone's gallery or camera. It is Arabic-first with English available, right-to-left by default.

The app remembers the bookings made on that device, so a customer reopens the app and sees their booking without a link or an ID. There is still no customer account.

Owner and staff can log in within the app to reach the review queue and to receive push notifications (see `push-notifications`).

## Data

No new server entities. On the device: the link tokens of bookings made there.

## Surface

- Consumes the existing `/api/v1` endpoints: content, occasions, availability, verification, bookings, proof upload.
- Deep links: the booking link sent by WhatsApp opens the app when installed, the website otherwise.

## Workflows

**Booking in the app.**

1. Customer opens the app, browses the calendar, picks a free slot.
2. Verifies their phone, holds the slot, sees the booking screen with countdown.
3. Pays in their wallet app, returns, uploads the screenshot.

**Returning.**

1. Customer opens the app later; "My booking" shows the current status.

## Edge cases and constraints

- The app must not fork the rules: everything is enforced by the same API as the web.
- Once the app ships, the JSON API cannot change incompatibly without versioning; old app versions stay in use for months.
- Store review and developer accounts for Google Play and the App Store are setup work outside the code.
- Offline: the app shows the last known booking status and says it is not live; it cannot hold a slot offline.
- Uninstalling loses the remembered bookings; the WhatsApp link and booking ID still work.

## Open questions

- Store developer accounts and signing credentials (Google Play, App Store) are setup work outside the code; no store build can be produced until they exist.
