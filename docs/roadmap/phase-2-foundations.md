---
id: phase-2-foundations
type: roadmap-phase
title: Phase 2 — Foundations
status: in-progress
last_modified: 2026-11-16
milestone: v1
phase_number: 2
sections: [staff-access, venue-settings, slot-schedule, message-delivery, phone-verification]
infrastructure_sections: []
---

# Phase 2 — Foundations

## Goal

Build what every booking depends on: staff login and roles with the audit log, the venue settings (occasions, prices, deposit, payment details), the slot schedule, message delivery with the outbox and job loop, and phone verification. Serves the back-office, availability, messaging and booking pillars.

## Prerequisites

Phase 1. Message delivery needs Twilio trial credentials for real sends; the fake sender covers development.

## Sections

### staff-access

Dashboard login, roles and the audit log. Extends `web`; data in `postgres`.

- [x] Integrate Better Auth with password login and Drizzle-backed sessions
- [x] Add `owner:create` script that creates the first owner on a fresh production database
- [x] Add owner and staff roles with an API authorization guard
- [x] Implement dashboard shell and login screen in Arabic and English
- [x] Implement staff account management for the owner (create, disable, reset password)
- [x] Implement audit-log table and helper recording every staff action
- [x] Continue to the original dashboard link after login when opened while logged out

### venue-settings

Occasions, prices, deposit and payment details. Extends `web`; data in `postgres`.

- [ ] Implement occasion CRUD API with Arabic/English names and price
- [ ] Implement settings API: deposit %, payment details, hold length, near-slot cutoff
- [ ] Implement owner-only settings screens for occasions, deposit and payment details

### slot-schedule

The weekly slot pattern, date exceptions and blocked dates. Extends `web`; data in `postgres`.

- [ ] Implement weekly slot pattern schema and API with overlap validation
- [ ] Implement date exceptions: custom slots for a date, or the date closed
- [ ] Implement slot resolver returning a date's slots from pattern plus exceptions
- [ ] Guard schedule edits against dates that have active bookings
- [ ] Implement schedule-editor view: weekly grid, exceptions list, block a date

### message-delivery

The messaging adapter, the outbox and the in-process job loop inside `web`; talks to Twilio.

- [ ] Define messaging adapter interface with fake sender and Twilio implementation
- [ ] Implement outbox table and in-process job loop with retry and backoff
- [ ] Implement Twilio status webhook with signature check and SMS fallback
- [ ] Add bilingual message templates: code, booking link, staff alert

### phone-verification

One-time codes that gate a hold. Extends `web`; data in `postgres`.

- [ ] Implement request-code endpoint: hashed code, expiry, rate limits per phone and IP
- [ ] Implement check-code endpoint issuing a short-lived verified-phone token
- [ ] Implement delivery-failure response carrying venue phone and WhatsApp contact
- [ ] Implement code entry step UI with resend timer and error states
