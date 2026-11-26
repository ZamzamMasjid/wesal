---
id: landing-page
type: feature
title: Landing Page
status: shipped
last_modified: 2026-11-26
milestone: v1
pillar: public-site
depends_on: [content-management, public-calendar, venue-settings]
views: [home]
adrs: [ADR-001, ADR-007, ADR-008, ADR-012, ADR-018, ADR-019, ADR-020, ADR-023]
roadmap_sections: [phase-5-public-site/landing-page]
architecture: [overview, testing]
components: [web, upload-volume]
---

# Landing Page

## Purpose

The public face of the venue. It is where a family decides whether Wesal suits their occasion and where every booking starts. It replaces the questions the owner answers by phone today: what the place looks like, what it costs, and how to book.

## Behavior

The page shows, in Arabic by default and in English on request: a short description of the mosque and event hall, a gallery of photos and videos, the price of each occasion, the booking and cancellation policy, and a phone number and WhatsApp contact for inquiries. A clear call to action leads to the availability calendar.

All content comes from what the owner entered in content management and venue settings; nothing on the page is hard-coded. The page is server-rendered so it loads quickly on slow phones and is readable by search engines. The language switch keeps the visitor on the same section.

## Data

No entities of its own. Reads:

- Site content (description, policy, contact) and media assets, from `content-management`.
- Active occasions with prices, and the deposit percentage, from `venue-settings`.

## Surface

- `GET /` and `GET /en` — the page, per locale.
- `GET /api/v1/content` — description, policy, contact and ordered media list.
- `GET /api/v1/occasions` — active occasions with names and prices.
- `GET /api/v1/media/{id}` — a photo or video file, with range requests and cache headers.

## Workflows

**A family evaluates the venue.**

1. Opens the page from a search result, a shared link or a QR code at the venue.
2. Looks through photos and videos, reads the description and prices.
3. Reads the policy, then taps "Check availability" and moves to the calendar.

**A family prefers to ask first.**

1. Taps the phone number or the WhatsApp button.
2. The call or chat happens outside the system; the owner may enter the booking by hand.

## Edge cases and constraints

- Videos are served from the app machine's volume; they must stream with range requests and must not autoplay with sound.
- If no media has been uploaded yet, the gallery section is omitted rather than shown empty and the hero falls back to a `photo-scrim` block with the venue name and actions.
- Occasion prices are shown with the deposit percentage so the deposit is no surprise later.
- Arabic and English each have their own URL with `hreflang` links; the Arabic page is the canonical default.
- The page must meet WCAG AA: image alt text is editable by the owner, and the gallery is keyboard-operable.
- If `postgres` is unavailable, a static notice with the venue's phone and WhatsApp is shown instead.

## Open questions

- Does the owner want a map or directions section? The seed linked a Google Maps listing but did not ask for a map on the page.
