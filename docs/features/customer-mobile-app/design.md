---
id: customer-mobile-app
type: feature-design
title: Customer Mobile App — Design
last_modified: 2026-11-15
feature: customer-mobile-app
---

# Customer Mobile App — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Same visual language as the website: the tokens, typefaces and slot-state colors in `docs/design/system.md` carry over unchanged, so the app reads as the same venue. Navigation follows each platform's conventions (bottom tabs, native back gesture) and mirrors for right-to-left. Native pickers are used for dates and images.

## Components

- **Tab bar** — Home, Calendar, My booking.
- **Home** — hero, gallery, prices, contact; the landing page's content in native layout.
- **Calendar and booking form** — the same steps as the web, as stacked screens.
- **My booking** — the booking page for bookings made on this device; a "Find by ID" entry for others.
- **Proof picker** — camera or gallery.
- **Staff entry** — a discreet "Staff login" in settings, leading to the review queue.

## States

| State | Behavior |
|---|---|
| Empty | My booking with nothing stored: "You have no booking on this device" with Find by ID and Open calendar |
| Loading | Native skeletons; cached content shown first |
| Error | Offline: last known content with an "offline" banner; booking actions disabled with an explanation |

## Interactions

Pull to refresh on the calendar and on My booking. The booking link from WhatsApp opens directly in the app on the right booking. Copy buttons for payment numbers use the system clipboard, and a shortcut offers to open the wallet app where the platform allows.
