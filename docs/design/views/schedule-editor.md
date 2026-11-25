---
id: schedule-editor
type: view
title: Slot Schedule
last_modified: 2026-11-25
feature: slot-schedule
mockup: none
---

# Slot Schedule

## Purpose

The owner defines the weekly pattern of bookable slots, gives specific dates their own slots, and blocks dates.

## Layout

Two tabs: Weekly pattern, and Exceptions.

```
Weekly pattern
+--------------------------------------------------+
| Schedule      [Weekly pattern] [Exceptions]      |
+--------------------------------------------------+
| Sat        Sun        Mon        Tue   ...  Fri  |
| 2:00-4:00  2:00-4:00  2:00-4:00  ...        4:30-|
| 4:30-7:00  4:30-7:00  4:30-7:00             7:00 |
| 7:30-10:00 7:30-10:00                            |
| [+ slot]   [+ slot]   [+ slot]   ...   [+ slot]  |
| [copy to...]                                     |
+--------------------------------------------------+
|                                  [ Save pattern ]|
+--------------------------------------------------+

Exceptions
+--------------------------------------------------+
| [ Block a date ]   [ Custom slots for a date ]   |
+--------------------------------------------------+
| Fri 25 Dec 2026    Closed      "maintenance"  [x]|
| Sat 20 Mar 2027    Custom: 10:00-1:00, 2:00-6:00 [edit]|
+--------------------------------------------------+
```

## Components

- Tabs
- Weekly grid with slot chips
- Slot editor (two time pickers, remove)
- Copy-day control
- Exceptions list
- Exception dialog (date, closed toggle, note, slots)
- Conflict panel listing blocking bookings

## States

| State | Description |
|---|---|
| Default | Current pattern and upcoming exceptions |
| Loading | Skeleton grid and list |
| Empty | No slots defined: prompt to add the venue's bookable times. No exceptions: "No special dates" |
| Error | Overlap or end-before-start inline on the slot; edit blocked by active bookings shows the conflict panel and saves nothing |

## Interactions

- "Add slot" adds a slot to a day (one hour, starting where the last ends); each slot is two time pickers offering every quarter hour, always editable, with a remove button. A stored time off the quarter hour (e.g. 23:59) is kept and offered too.
- "Copy to" copies a day's slots to selected other days.
- "Save pattern" saves the whole week after validation.
- "Block a date" opens the exception dialog with closed preselected.
- "Custom slots for a date" opens it; choosing the date prefills the weekday's pattern until the owner edits a slot. The dialog is a modal; the date of an existing exception cannot be changed.
- Removing an exception asks for confirmation, then returns the date to the weekly pattern.
- The conflict panel lists the blocking bookings by number and start time; they become links when booking management exists.

## Responsive behavior

- Below `md`: days become an accordion, one open at a time; the Save button is sticky.
- `md` to `lg`: seven columns, scrollable horizontally if needed.
- `lg` and up: seven columns fit without scrolling.

## Accessibility

- Each day is a labelled group; slot chips are buttons named with their times.
- Time pickers are native selects: every time is one tap away and nothing needs to be typed.
- Validation errors are announced and focus moves to the first offending slot.
- The conflict panel lists bookings as links and is announced when it appears.
- The week starts on Saturday in both languages; in Arabic the columns run right to left.
