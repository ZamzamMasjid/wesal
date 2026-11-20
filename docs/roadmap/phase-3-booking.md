---
id: phase-3-booking
type: roadmap-phase
title: Phase 3 — Booking
status: in-progress
last_modified: 2026-11-18
milestone: v1
phase_number: 3
sections: [public-calendar, booking-hold, booking-page, payment-proof]
infrastructure_sections: []
---

# Phase 3 — Booking

## Goal

Deliver the customer path of the booking pillar and the public half of availability: the calendar with slot states, the 20-minute hold with the no-overlap guarantee, the private booking page, and the payment proof upload with its one-day purge.

## Prerequisites

Phase 2: the slot schedule, venue settings, phone verification and message delivery.

## Sections

### public-calendar

The public view of availability. Extends `web`; reads `postgres`.

- [x] Implement availability API: slot states for a date range with expiry by timestamp
- [x] Implement calendar view: month picker, day slots, state labels, disabled taken slots
- [x] Add 30-second and on-focus refresh of slot states

### booking-hold

Creating a 20-minute hold with no double booking. Extends `web`; constraint lives in `postgres`.

- [ ] Add bookings table with exclusion constraint on overlapping active time ranges
- [ ] Implement create-hold endpoint: verified phone, transaction, conflict error
- [ ] Implement near-slot deadline cutoff and urgent flag
- [ ] Implement tidy-up sweep in the job loop marking overdue holds expired
- [ ] Implement booking-form view: occasion, name, phone, conflict message
- [ ] Queue the booking-link message on hold creation

### booking-page

The private page a customer returns to. Extends `web`; reads `postgres`.

- [ ] Implement booking read API by link token and rate-limited lookup by booking ID
- [ ] Implement booking-status view: transfer details, deposit, countdown, status
- [ ] Implement find-my-booking form by booking ID

### payment-proof

Uploading the transfer screenshot. Extends `web`; files on `upload-volume`.

- [ ] Implement proof upload endpoint: type and size checks, store on volume, stop countdown
- [ ] Implement upload UI and WhatsApp button prefilled with the booking ID
- [ ] Implement daily purge of proof files older than one day
