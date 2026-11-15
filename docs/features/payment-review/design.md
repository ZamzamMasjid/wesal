---
id: payment-review
type: feature-design
title: Payment Review — Design
last_modified: 2026-11-15
feature: payment-review
---

# Payment Review — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Designed for a phone held in one hand, because the owner reviews with his wallet app open on the same device. The expected deposit amount is the largest text on the review page, in the monospace face, so it can be compared with the wallet at a glance. Confirm is `brand`; Reject is outlined `danger`, never side by side at equal weight.

## Components

- **Queue item** — occasion, date and slot, customer name, deposit amount, waiting time, urgent badge.
- **Review page** — booking summary, expected deposit, screenshot, action bar.
- **Screenshot viewer** — fits the width; tap opens full screen with pinch zoom.
- **Action bar** — sticky at the bottom: Confirm, Reject.
- **Reject dialog** — reason choices (wrong amount, unreadable image, no transfer found, other) with an optional note.
- **Mark proof received** — action on a held booking, with an optional "and confirm" checkbox.

## States

| State | Behavior |
|---|---|
| Empty | "No payments to review" with a calm icon |
| Loading | Skeleton queue items; the screenshot shows a placeholder at its final size |
| Error | Screenshot purged or missing: "Screenshot no longer available", actions still usable. Already decided by someone else: message with the current status and a link back to the queue |

## Interactions

Confirm and Reject each ask once before applying. After a decision the next queue item opens automatically, or the empty state. The queue refreshes on focus and every 30 seconds; the Review badge in the navigation updates with it.
