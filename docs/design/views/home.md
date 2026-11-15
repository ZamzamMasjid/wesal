---
id: home
type: view
title: Landing
last_modified: 2026-11-15
feature: landing-page
mockup: approved
---

# Landing

## Purpose

The visitor learns what the venue is, sees it, finds out what each occasion costs, and starts a booking or contacts the venue. It is the entry point for almost every customer.

## Layout

> Visual truth: docs/design/mockups/home.html

Single scrolling page, capped at 1120px. Shown in reading order; in Arabic everything mirrors.

1. **Header** — wordmark on the start side; on the end side one pill holding "Find my booking", the language switch and the theme toggle.
2. **Hero photograph** — one wide venue photograph with rounded corners. Nothing is laid over it and it carries no action.
3. **Introduction** — the venue name (the page's `h1`) on the start side, the description text beside it.
4. **Gallery** — heading, then a grid of photo and video tiles; the first tile is double width.
5. **Prices** — heading, a one-line note and the deposit note on the start side; a two-by-two grid of occasion cards beside them. Under the cards sits the page's primary action, "Check availability".
6. **Booking policy** — one collapsible card with numbered rules.
7. **Contact** — a `brand` block with the phone number and Call and WhatsApp buttons.
8. **Footer** — the "Find my booking by booking ID" link.

Prices in the mockup are placeholders; real values come from venue settings.

## Components

- Header with "Find my booking", language switch and theme toggle
- Hero photograph
- Introduction block (venue name and description)
- Gallery grid with lightbox (Radix Dialog); video tiles show a duration chip
- Occasion price cards, each with name, price and a go arrow
- Primary action "Check availability"
- Policy block (Radix Collapsible)
- Contact block, and a sticky contact bar on phones
- Footer with the "Find my booking" link

## States

| State | Description |
|---|---|
| Default | All sections populated from content and settings |
| Loading | Server-rendered; images fade in from blurred placeholders |
| Empty | No media: gallery omitted. No occasions: the price cards and primary action are replaced by a card with a contact prompt, Call and WhatsApp |
| Error | Database unavailable: the page body is replaced by one centered notice with the phone number, Call and WhatsApp |

## Interactions

- "Check availability" opens the calendar view.
- Tapping an occasion card opens the calendar with that occasion preselected.
- Tapping a gallery item opens the lightbox; swipe or arrow keys move between items; videos play on tap, muted.
- Call and WhatsApp buttons leave the site to the dialer or a WhatsApp chat.
- The language switch reloads the same page in the other language.

## Responsive behavior

- Below `sm`: one column; gallery two across with the first tile full width; price cards one per row with a full-width primary action; the contact block shows the number only and a sticky bar at the bottom of the screen carries Call and WhatsApp.
- `md`: introduction and prices become two columns; gallery three across.
- `lg` and up: content capped at 1120px; gallery four across.

## Accessibility

- One `h1` (the venue name); each section has an `h2`.
- A long occasion name wraps to two lines and is then cut; the full name stays in the link's accessible name.
- Gallery items are buttons with the owner's alternative text; the lightbox traps focus and closes on Escape.
- Videos have controls and never autoplay with sound.
- The language switch is a link with `lang` and `hreflang`; `dir` is set on the document.
- The sticky contact bar does not cover focused elements.
