---
id: public-calendar
type: feature
title: Public Calendar
status: shipped
last_modified: 2026-11-18
milestone: v1
pillar: availability
depends_on: [slot-schedule]
views: [calendar]
adrs: [ADR-010, ADR-012, ADR-014, ADR-018]
roadmap_sections: [phase-3-booking/public-calendar]
architecture: [data-model, flows, testing]
components: [web, postgres]
---

# Public Calendar

## Purpose

Shows anyone, without calling, when the venue is free. Taken slots are not hidden: they stay visible but disabled, each labelled with its state. That is what makes the calendar believable, and it lets a family watch a provisionally booked slot in case it frees up.

## Behavior

A visitor picks a day and sees that day's slots with their times. Each slot is in exactly one state:

| State | Meaning | Selectable |
|---|---|---|
| Free | No active booking | Yes |
| Awaiting payment | Held; deposit not yet uploaded | No |
| Awaiting review | Proof uploaded; owner has not decided | No |
| Confirmed | Booked | No |
| Closed | The owner closed the date; the day lists no slots | No |

Selecting a free slot leads to the booking form. Slot states refresh about every 30 seconds and whenever the page regains focus. No customer details are ever shown on the calendar.

The response also tells the page what a visitor may do with a free slot, so the rule lives in one place: `book` (open the booking form), `call` (the slot is inside the near-slot cutoff, so show the venue's contact instead), or `none` (past or already started). Taken slots always carry `none`.

## Data

No entities of its own. Combines the slot resolver's output (from `slot-schedule`) with active bookings.

A held booking whose deadline has passed counts as free, whether or not the sweep has marked it expired.

## Surface

- `GET /api/v1/availability?from=YYYY-MM-DD&to=YYYY-MM-DD` — public. For each date: `day`, `closed`, and `slots` with `start`, `end`, `state` and `action`. The envelope also carries `from`, `to`, `today` (the venue's date, used to dim past days) and `refreshedAt`. The range may span at most 62 days and must be real dates in order. Served with `Cache-Control: public, max-age=5`; the response is at most 30 seconds stale by ADR-014, and the hold endpoint still refuses a double booking.

## Workflows

**Finding a free slot.**

1. Visitor opens the calendar from the landing page; the current month is shown with days marked as having free slots or not.
2. Taps a day; its slots appear with states.
3. Taps a free slot and continues to the booking form.

**Watching a provisional slot.**

1. Visitor sees the slot they want is awaiting payment.
2. Leaves the page open or returns later; when the hold expires the slot becomes free on the next refresh.

## Edge cases and constraints

- The calendar may be up to 30 seconds stale. The server still refuses a double hold; the visitor then sees the slot-conflict message.
- Past dates and slots that have already started are not selectable.
- A slot starting sooner than the near-slot cutoff is shown with "call to book" and the venue's contact instead of being selectable (see `booking-hold`).
- A day with no slots at all reads "not available" with the venue's contact.
- States are conveyed by text and icon, not color alone.
- No open connection per visitor: refresh is by polling only.

## Open questions

Settled: the month view shows only a free-versus-full marker per day, with no count of free slots. A count invites comparison shopping against the detailed day panel and dates faster than a 30-second poll can keep it right.
