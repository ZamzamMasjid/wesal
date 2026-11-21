---
id: payment-proof
type: feature
title: Payment Proof
status: shipped
last_modified: 2026-11-21
milestone: v1
pillar: booking
depends_on: [booking-page]
views: []
adrs: [ADR-005, ADR-018, ADR-022]
roadmap_sections: [phase-3-booking/payment-proof]
architecture: [overview, data-model, flows, testing]
components: [web, postgres, upload-volume]
---

# Payment Proof

## Purpose

Lets the customer show they have transferred the deposit. The screenshot is the only evidence Wesal ever sees of a payment: there is no payment gateway, and the owner verifies the money on his own phone.

## Behavior

On the booking page, while the booking is held or awaiting review, the customer uploads a screenshot of the transfer. The upload stops the countdown, the booking becomes "awaiting review", and the owner and staff are alerted (the alert message itself is sent by Staff Notifications). A second upload while awaiting review adds another proof, and staff see the newest first. Alternatively the customer taps a WhatsApp button that opens a chat with the venue, prefilled with the booking ID, and sends the screenshot there; staff then mark the proof as received in the dashboard, which has the same effect.

Screenshots are kept for one day, but never deleted while the booking still awaits review. After that the file is deleted; the owner saves any he wants to keep. The record that a proof was provided remains.

## Data

- **Payment proof** — booking, file path, received via (upload or WhatsApp), uploaded at, purged at.

Files are stored on the app machine's volume and are served only to logged-in staff.

## Surface

- `POST /api/v1/bookings/by-token/{token}/proof` — multipart image. Errors: `HOLD_EXPIRED`, `INVALID_FILE`, `FILE_TOO_LARGE`, `SERVICE_UNAVAILABLE`.
- `GET /api/v1/staff/proofs/{id}/file` — staff only.
- Internal: the daily purge job in the job loop.

## Workflows

**Uploading.**

1. Customer taps "Upload transfer screenshot", picks the image from their gallery.
2. Sees the chosen image, then upload progress, then "awaiting review" and no countdown.

**Sending by WhatsApp instead.**

1. Customer taps the WhatsApp button; a chat opens with the booking ID prefilled.
2. Sends the screenshot. The page tells them the booking stays held until the venue marks it received, and the countdown keeps running until then.

## Edge cases and constraints

- An upload after the deadline is refused; the booking has expired and the customer starts again.
- Only JPEG, PNG and WebP images up to 10 MB are accepted; the file type is checked from content, not the extension or what the browser claims. A HEIC camera photo is refused with a pointer to WhatsApp.
- A second upload while awaiting review adds another proof; staff see the latest first. The upload area stays on the page and offers another screenshot.
- If the volume cannot be written, the customer is told to retry or use the WhatsApp button; the booking stays held and the countdown keeps running.
- Any uploaded image, genuine or not, locks the slot until staff review it. Carried from the idea brief as a noted risk.
- The WhatsApp path does not stop the clock by itself; only a staff action does.

## Open questions

None. A file older than a day is purged unless its booking is still awaiting review; such a file is purged on the first daily run after staff decide.
