---
id: ADR-033
type: adr
title: Build the customer app with Expo and React Native
last_modified: 2026-11-21
decision_status: Accepted
phase_section: phase-7-mobile-app/customer-mobile-app
mirror_id: ""
counterpart_adrs: []
---

# ADR-033: Build the customer app with Expo and React Native

## Context
The mobile app repeats the web experience over the same `/api/v1` endpoints: content, occasions, availability, phone verification, holds, the private booking page and proof upload. The feature spec assumed Expo and React Native, matching the owner's other project, and left the choice open until the phase started. The app needs Arabic-first right-to-left layout, native image picking and deep links, and it must not fork any booking rule.

## Decision
Build the app with Expo and React Native in a `mobile/` workspace, in TypeScript, using Expo Application Services for store builds. Navigation is a local tab state (Home, Calendar, Booking) over plain React Native views, with the API client and bilingual strings kept in small modules so screens stay readable. The API stays authoritative: the app calls the same operations and shows the same error codes.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Flutter | A second language and toolchain beside the web app; the owner already runs Expo elsewhere. |
| A wrapped web view | Cheapest, but no native image picker, deep links or push registration, and the app would feel like the website in a frame. |
| Separate native Kotlin and Swift apps | Two codebases for one small experience, with the same API and screens twice. |

## Consequences
- One JavaScript codebase for Android and iOS, and the team's existing Expo experience applies.
- Store builds need Google Play and App Store accounts and signing credentials, set up outside the code; EAS configuration is checked in so the build is one command once credentials exist.
- The app must be installed and built again for native changes; the web app remains the fallback for everyone else.
- Expo's push service becomes the delivery path for staff notifications (ADR-034).
