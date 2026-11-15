---
id: public-calendar
type: feature-design
title: Public Calendar — Design
last_modified: 2026-11-15
feature: public-calendar
---

# Public Calendar — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

Slot states use the fixed semantic colors in `docs/design/system.md`, each with its label and icon. Taken slots are visibly present, not greyed into invisibility: the point is that visitors see a busy, honest calendar. The week starts on Saturday. Month names are Gregorian, in the active language.

## Components

- **Month grid** — days with a marker: has free slots, fully taken, closed, or past.
- **Day panel** — the selected day's slots as large cards: time range, state badge, and for free slots a "Book" action.
- **State legend** — the five states with their labels.
- **Refreshed indicator** — a quiet "updated just now" line.
- **Contact fallback** — venue phone and WhatsApp, shown for near slots and empty days.

## States

| State | Behavior |
|---|---|
| Empty | Day with no slots: "The venue is not available on this day" with the contact fallback |
| Loading | First load: skeleton month and slot cards. Refresh: previous states stay visible; no flash |
| Error | Availability cannot be loaded: inline message with Retry and the contact fallback |

## Interactions

Tapping a day selects it and moves focus to the day panel. Arrow keys move between days; Enter selects. Tapping "Book" on a free slot goes to the booking form with the slot carried over. Taken slots are focusable and announce their state but have no action. A slot that changes state during a refresh animates its badge once, unless reduced motion is on.
