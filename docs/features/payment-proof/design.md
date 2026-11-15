---
id: payment-proof
type: feature-design
title: Payment Proof — Design
last_modified: 2026-11-15
feature: payment-proof
---

# Payment Proof — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Inherits from `docs/design/system.md`. The upload action is the primary button on the booking page while the booking is held; the WhatsApp path is a clearly secondary alternative beneath it.

## Components

- **Upload button** — opens the phone's gallery or file picker; accepts images only.
- **Preview** — thumbnail of the chosen image with "Send" and "Choose another".
- **Progress bar** — determinate, during upload.
- **WhatsApp button** — opens a chat with the venue, prefilled with the booking ID, with a note that the countdown continues until the venue marks the proof received.
- **Sent state** — thumbnail and "Received, awaiting review".

## States

| State | Behavior |
|---|---|
| Empty | Upload button and the WhatsApp alternative |
| Loading | Preview dimmed with the progress bar; Send disabled |
| Error | Wrong type or too large: message under the button, nothing uploaded. Network or storage failure: Retry, with the WhatsApp alternative emphasised. Hold expired during upload: the page moves to the expired state |

## Interactions

Choosing an image shows the preview first so a wrong image is caught before sending. After a successful upload the countdown disappears and the status header changes to awaiting review. The customer may upload another image while awaiting review, for example if the first was unreadable.
