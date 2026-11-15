---
id: phase-6-alerts-and-reports
type: roadmap-phase
title: Phase 6 — Alerts and Reports
status: planned
last_modified: 2026-11-15
milestone: later
phase_number: 6
sections: [slot-alerts, booking-reports]
infrastructure_sections: []
---

# Phase 6 — Alerts and Reports

## Goal

Add the two deferred web capabilities: slot alerts for people watching a taken slot, and owner reports on bookings and income.

## Prerequisites

The first push (phases 1 to 5) shipped, with real bookings accumulated for reports to be meaningful.

## Sections

### slot-alerts

"Tell me if this slot frees up" for people watching a taken slot.

- [ ] Implement alert signup on a taken slot with phone verification
- [ ] Notify subscribers through the outbox when the slot becomes free

### booking-reports

Owner reports on bookings and income.

- [ ] Implement reports API: bookings and income by month and occasion
- [ ] Implement reports view with period filter and export
