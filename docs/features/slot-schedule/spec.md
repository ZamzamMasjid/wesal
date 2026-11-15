---
id: slot-schedule
type: feature
title: Slot Schedule
status: planned
last_modified: 2026-11-15
milestone: v1
pillar: availability
depends_on: [staff-access]
views: [schedule-editor]
adrs: [ADR-003, ADR-012, ADR-018]
roadmap_sections: [phase-2-foundations/slot-schedule]
architecture: [data-model, auth, testing]
components: [web, postgres]
---

# Slot Schedule

## Purpose

Defines when the venue can be booked. The owner sets the bookable periods himself, with his own start and end times (for example 2:00–4:00 and 4:30–7:00), instead of the system imposing a grid. Everything the public calendar shows and every hold a customer creates is derived from this schedule.

## Behavior

The schedule has two layers:

- A **weekly pattern**: for each weekday, the list of slots that apply by default. Fridays can differ from Mondays.
- **Date exceptions**: for a specific date, either a different list of slots or the date closed entirely. Closing a date is how the owner blocks it.

The slots for any date are the exception's slots if one exists, otherwise the weekday's pattern. Slots on the same date may not overlap. Only the owner edits the schedule.

Price does not depend on the slot; it depends on the occasion (see `venue-settings`).

## Data

- **Slot pattern** — weekday, start time, end time.
- **Date exception** — date, closed flag.
- **Exception slot** — start time, end time, belonging to an exception.

Slots are computed, not stored per date. A booking keeps its own start and end, so editing the schedule never changes an existing booking.

## Surface

- `GET /api/v1/staff/schedule/pattern`, `PUT /api/v1/staff/schedule/pattern` — owner only; the whole weekly pattern.
- `GET /api/v1/staff/schedule/exceptions?from&to` — owner only.
- `PUT /api/v1/staff/schedule/exceptions/{date}`, `DELETE /api/v1/staff/schedule/exceptions/{date}` — owner only.
- Internal: the slot resolver, used by `public-calendar` and `booking-hold`.

## Workflows

**Setting the weekly pattern.**

1. Owner opens the schedule editor and adds slots to each weekday.
2. Saving validates that no two slots on a day overlap and that each ends after it starts.

**Blocking a date.**

1. Owner picks a date and marks it closed, optionally with a note.
2. The public calendar shows that date as closed.

**A special day.**

1. Owner picks a date (for example during Eid) and gives it its own slots.
2. Those slots replace the weekday pattern for that date only.

## Edge cases and constraints

- An edit that would remove or change a slot on a date with an active booking is refused, with a list of the affected bookings. The owner cancels or waits first.
- Pattern changes apply to future dates only in effect: existing bookings keep their stored times.
- All times are Africa/Cairo. A slot may not cross midnight in v1.
- Closing a date with active bookings is refused for the same reason as other conflicting edits.
- Every schedule change writes an audit row.

## Open questions

- How far ahead should dates be bookable (a booking horizon), and is that a setting?
- Should a slot be allowed to cross midnight for late evening occasions?
