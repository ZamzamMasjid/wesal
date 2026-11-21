---
id: phase-4-operations
type: roadmap-phase
title: Phase 4 — Operations
status: in-progress
last_modified: 2026-11-21
milestone: v1
phase_number: 4
sections: [payment-review, staff-notifications, booking-management]
infrastructure_sections: []
---

# Phase 4 — Operations

## Goal

Deliver the owner and staff half: reviewing proofs and confirming or rejecting, alerts to staff, and managing all bookings including phone and walk-in entry. Completes the back-office and messaging pillars for the first push.

## Prerequisites

Phase 3: holds and payment proofs exist to review. Phase 2: staff access and the outbox.

## Sections

### payment-review

Staff confirm or reject uploaded proofs. Extends `web`; reads `upload-volume`.

- [x] Implement review queue API and confirm/reject endpoints with audit entries
- [x] Implement review-queue view with screenshot viewer and confirm/reject actions
- [x] Implement deep link from a staff alert to that booking's review page after login
- [x] Implement mark-proof-received for screenshots sent over WhatsApp
- [x] Write e2e test: staff reviews, confirms and rejects a booking

### staff-notifications

Alerts to owner and staff through the outbox in `web`.

- [x] Queue staff alert on proof upload with a link to the review page
- [x] Queue urgent alert for holds on slots starting soon
- [x] Implement per-staff notification phone and opt-in setting

### booking-management

The full list of bookings and manual entry. Extends `web`.

- [ ] Implement bookings list API with filters by date, status and source
- [ ] Implement phone/walk-in booking entry with conflict handling
- [ ] Implement cancel booking and mark remainder paid, with audit entries
- [ ] Implement bookings view: list, detail, add-booking dialog
