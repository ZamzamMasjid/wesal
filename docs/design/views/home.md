---
id: home
type: view
title: Landing
last_modified: 2026-11-26
feature: landing-page
mockup: archived
---

# Landing

## Purpose

The visitor learns what the venue is, sees it, finds out what each occasion costs, and starts a booking or contacts the venue. It is the entry point for almost every customer.

## Layout

> Visual truth: docs/design/mockups/home.html (archived). It still shows the tokens and section rhythm, but the full-bleed hero and mosaic gallery supersede its layout.

Single scrolling page, capped at 1120px. Shown in reading order; in Arabic everything mirrors.

1. **Header** — floats inside the hero photograph: wordmark on the start side in the photo copy color; on the end side one pill holding "Find my booking", the language switch and the theme toggle.
2. **Hero photograph** — full-bleed, edge to edge, with a dark scrim. The venue name (the page's `h1`), "Check availability" and a WhatsApp or Call action sit over it in the photo copy color.
3. **Introduction** — "About the venue" (`h2`) on the start side, the description text beside it. Omitted when the owner has not written a description.
4. **Gallery** — heading, then a curated mosaic: one large tile, four regular tiles, one wide tile and two regular tiles. When the library is larger than the mosaic, a count tile (`+N photos`) opens the full lightbox.
5. **Prices** — heading, a one-line note and the deposit note on the start side; a two-by-two grid of occasion cards beside them.
6. **Booking policy** — one collapsible card with numbered rules.
7. **Contact** — a `brand` block with the phone number and Call and WhatsApp buttons.

Prices in the mockup are placeholders; real values come from venue settings. The mockup predates the full-bleed hero and the mosaic gallery; the tokens it shows are still authoritative.

## Components

- Header with "Find my booking", language switch and theme toggle; photo variant over the hero
- Full-bleed hero photograph with scrim, venue name, primary and contact actions
- Introduction block with "About the venue" and the description
- Gallery mosaic with lightbox (Radix Dialog); the count tile opens the first hidden photo; video tiles show a play chip
- Occasion price cards, each with name, price and a go arrow
- Policy block (Radix Collapsible)
- Contact block, and a sticky contact bar on phones

## States

| State | Description |
|---|---|
| Default | All sections populated from content and settings |
| Loading | Server-rendered; images sit on the fill color until they load |
| Empty | No media: the hero becomes a `photo-scrim` block with the copy and no photograph, and the gallery is omitted. No description: the introduction is omitted. No occasions: the price cards are replaced by a card with a contact prompt, Call and WhatsApp |
| Error | Database unavailable: the page body is replaced by one centered notice with the phone number, Call and WhatsApp |

## Interactions

- "Check availability", in the hero, opens the calendar view.
- Tapping an occasion card opens the calendar with that occasion preselected.
- Tapping a gallery item opens the lightbox; the count tile opens the first photo it hides; swipe or arrow keys move through the whole library; videos play on tap, muted.
- Call and WhatsApp buttons leave the site to the dialer or a WhatsApp chat.
- The language switch reloads the same page in the other language.

## Responsive behavior

- Below `sm`: hero about `84svh` (capped); one column; gallery two across with the first tile full width, the wide tile full width and the count tile a regular tile; price cards one per row; the contact block shows the number only and a sticky bar at the bottom of the screen carries Call and WhatsApp.
- `md`: introduction and prices become two columns; the gallery becomes four across with fixed row heights and the mosaic spans.
- `lg` and up: content capped at 1120px; the hero stays full-bleed.

## Accessibility

- One `h1` (the venue name) in the hero; each section has an `h2`.
- Copy over the photograph uses the fixed `photo-fg` and `photo-scrim` tokens, so it clears the image in both themes.
- A long occasion name wraps to two lines and is then cut; the full name stays in the link's accessible name.
- Gallery items are buttons with the owner's alternative text; the count tile is labelled "Show all photos (N)"; the lightbox traps focus and closes on Escape.
- Videos have controls and never autoplay with sound.
- The language switch is a link with `lang` and `hreflang`; `dir` is set on the document.
- The sticky contact bar does not cover focused elements.
