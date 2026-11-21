---
id: phase-5-public-site
type: roadmap-phase
title: Phase 5 — Public Site
status: in-progress
last_modified: 2026-11-21
milestone: v1
phase_number: 5
sections: [content-management, landing-page]
infrastructure_sections: []
---

# Phase 5 — Public Site

## Goal

Deliver the public-site pillar: owner-editable content and media, and the landing page that presents the venue and leads into the calendar. Closes the first push with the end-to-end booking journey test and an accessibility pass.

## Prerequisites

Phase 2 (staff access, venue settings) and phase 3 (the calendar the landing page links to).

## Sections

### content-management

Owner-editable content and media. Extends `web`; files on `upload-volume`.

- [x] Implement site content API: description, policy, contact in Arabic and English
- [x] Implement media upload and ordering for photos and videos on the volume
- [x] Implement owner-only content editor screens

### landing-page

The public home page. Extends `web`.

- [x] Implement home view: hero, gallery, occasion prices, policy, contact
- [x] Add calendar entry point and booking call to action
- [ ] Add SEO metadata, Open Graph and hreflang for Arabic and English
- [ ] Serve media with range requests and caching headers
- [ ] Write e2e test: booking journey from home to uploaded proof in both languages
- [ ] Run WCAG AA pass on public views and fix findings
