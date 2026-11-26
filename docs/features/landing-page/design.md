---
id: landing-page
type: feature-design
title: Landing Page — Design
last_modified: 2026-11-26
feature: landing-page
---

# Landing Page — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

The hero is a full-bleed venue photograph with a dark scrim; the venue name, tagline and actions sit over it in the fixed photo copy color. The "About the venue" heading and description follow below it. Sections are separated by whitespace alone; there is no ornament and no divider. Content sits in soft-shadowed cards on the sand background.

The gallery is a curated mosaic, not a uniform grid: one large tile, four regular tiles, one wide tile and two regular tiles. When the library is larger, a count tile opens the full lightbox. This keeps a library of near-identical exterior shots from reading as repetition.

Photography is the color. The interface around it stays in `bg`, `surface`, `fg` and `brand`; over a photograph it uses `photo-fg` and `photo-scrim` so the copy clears the image in both themes.

## Components

- **Hero** — full-bleed photograph with scrim, venue name, tagline, "Check availability", a WhatsApp or Call action and an "Explore the venue" cue. Without media it becomes a `photo-scrim` block with the same copy.
- **Introduction** — "About the venue" and the description.
- **Primary action** — "Check availability", in the hero and under the price cards.
- **Gallery** — curated mosaic of photos and videos with a count tile; opens a lightbox (dialog) with swipe and arrow-key navigation. Videos show a poster and play on tap, muted by default.
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
