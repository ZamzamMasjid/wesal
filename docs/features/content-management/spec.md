---
id: content-management
type: feature
title: Content Management
status: planned
last_modified: 2026-11-15
milestone: v1
pillar: public-site
depends_on: [staff-access]
views: []
adrs: [ADR-001, ADR-005, ADR-012, ADR-018]
roadmap_sections: [phase-5-public-site/content-management]
architecture: [overview, data-model, auth, testing]
components: [web, postgres, upload-volume]
---

# Content Management

## Purpose

Lets the owner keep the public site current without a developer: the venue description, the policy text, the contact details, and the photos and videos. Only the owner may change content; staff cannot.

## Behavior

In the dashboard the owner edits each text in Arabic and English side by side, uploads photos and videos, sets their order, gives each an alternative text, and removes them. Changes appear on the public site as soon as they are saved. There is no draft or preview state in v1; saving is publishing.

## Data

- **Site content** — keyed texts, each with an Arabic and an English value: description, policy, contact phone, WhatsApp number, and any short headings the landing page needs.
- **Media asset** — kind (photo or video), file path on the volume, position, alternative text in both languages.

## Surface

- `GET /api/v1/content` — public read.
- `PUT /api/v1/staff/content` — owner only; replaces the keyed texts.
- `POST /api/v1/staff/media` — owner only; multipart upload.
- `PATCH /api/v1/staff/media/{id}` — owner only; alternative text and position.
- `DELETE /api/v1/staff/media/{id}` — owner only; removes the row and the file.

## Workflows

**Updating the policy text.**

1. Owner opens Content in the dashboard and edits the policy in both languages.
2. Saves; the change is audited and visible on the landing page at once.

**Adding venue photos.**

1. Owner uploads one or more images; each shows upload progress.
2. Adds alternative text and drags (or uses move buttons) to set the order.
3. The gallery on the landing page reflects the new order.

## Edge cases and constraints

- Uploads are checked for type (common image and video formats) and size before being written; the limits are settings, not constants.
- Venue media persists; it is not affected by the one-day purge that applies to payment screenshots.
- Deleting a media asset removes the file from the volume; there is no recycle bin.
- An English value left empty falls back to the Arabic text on the English page, so a half-translated site never shows blanks.
- Every content and media change writes an audit row.
- Files live on the single app machine's volume; large videos count against its disk, so the editor shows remaining space.

## Open questions

- What are sensible maximum sizes for a photo and a video on the chosen Fly volume?
