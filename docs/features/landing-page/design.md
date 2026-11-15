---
id: landing-page
type: feature-design
title: Landing Page — Design
last_modified: 2026-11-15
feature: landing-page
---

# Landing Page — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

The hero is one wide venue photograph with rounded corners and nothing laid over it. The venue name and description follow below it. Sections are separated by whitespace alone; there is no ornament and no divider. Content sits in soft-shadowed cards on the sand background.

Photography is the color. The interface around it stays in `bg`, `surface`, `fg` and `brand`.

## Components

- **Hero** — the venue photograph only.
- **Introduction** — venue name and description.
- **Primary action** — "Check availability", placed under the price cards.
- **Gallery** — grid of photos and videos; opens a lightbox (dialog) with swipe and arrow-key navigation. Videos show a poster and play on tap, muted by default.
- **Price list** — one row per occasion: name and price in EGP, with a note stating the deposit percentage.
- **Policy block** — collapsible text.
- **Contact bar** — phone and WhatsApp buttons; sticky at the bottom on phones.
- **Language switch** — in the header; shows the other language's name in its own script.
- **Theme toggle** — in the header.

## States

| State | Behavior |
|---|---|
| Empty | No media uploaded: gallery section omitted. No occasions: price section replaced by "contact us for prices" with the contact bar |
| Loading | Server-rendered, so no page skeleton; gallery images fade in from a blurred placeholder |
| Error | Database unavailable: static notice with venue phone and WhatsApp |

## Interactions

The primary action scrolls or navigates to the calendar. Tapping a price row goes to the calendar with that occasion preselected. The contact bar's WhatsApp button opens a chat with the venue; the phone button dials. Switching language keeps the scroll position's section.
