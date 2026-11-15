---
id: content-management
type: feature-design
title: Content Management — Design
last_modified: 2026-11-15
feature: content-management
---

# Content Management — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Inherits from `docs/design/system.md` at dashboard density. Arabic and English fields for the same text sit side by side on desktop (Arabic at the start side) and stacked on phones, each field set to its own direction regardless of the dashboard language.

## Components

- **Bilingual text field** — a pair of inputs or text areas labelled with the language, with a "same as Arabic" hint when English is empty.
- **Media grid** — thumbnails with drag handles, move-up and move-down buttons, alternative-text field and delete.
- **Uploader** — drop zone and file picker with per-file progress and type and size errors.
- **Disk space meter** — remaining space on the volume.
- **Save bar** — sticky; appears when there are unsaved text changes.

## States

| State | Behavior |
|---|---|
| Empty | No media: drop zone fills the grid area with "Add photos and videos of the venue" |
| Loading | Skeleton rows for text fields, skeleton tiles for media |
| Error | Upload failure shown on the tile with Retry; save failure keeps the form contents and shows the error inline |

## Interactions

Text changes are saved explicitly with the save bar; leaving with unsaved changes asks for confirmation. Media uploads, reordering and deletion take effect immediately, each confirmed by a toast; deletion asks first. A "View site" link opens the landing page in a new tab.
