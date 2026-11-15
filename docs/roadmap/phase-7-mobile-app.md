---
id: phase-7-mobile-app
type: roadmap-phase
title: Phase 7 — Mobile App
status: planned
last_modified: 2026-11-15
milestone: later
phase_number: 7
sections: [customer-mobile-app, push-notifications]
infrastructure_sections: []
---

# Phase 7 — Mobile App

## Goal

Deliver the mobile-app pillar: the booking experience as a mobile app over the existing JSON API, and push notifications for owner and staff.

## Prerequisites

The first push shipped and its JSON API stable. Developer accounts for Google Play and the App Store, and push credentials.

## Sections

### customer-mobile-app

The booking experience as a mobile app over the same JSON API.

- [ ] Scaffold Expo app with Arabic/English and RTL, consuming `/api/v1`
- [ ] Implement calendar, booking form, booking page and proof upload screens
- [ ] Produce Android and iOS store builds

### push-notifications

Push alerts for owner and staff.

- [ ] Implement device registration endpoint and a push sender behind the messaging adapter
- [ ] Send push on proof upload and urgent holds to signed-in staff devices
