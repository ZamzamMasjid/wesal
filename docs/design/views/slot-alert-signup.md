---
id: slot-alert-signup
type: view
title: Slot Alert Signup
last_modified: 2026-11-15
feature: slot-alerts
mockup: none
---

# Slot Alert Signup

## Purpose

A visitor asks to be told if a taken slot frees up. Reached from "Notify me" on a slot that is awaiting payment or awaiting review.

## Layout

A short single-column page (or a bottom sheet on phones) over the calendar.

```
+--------------------------------------------------+
| Notify me if this slot frees up                  |
+--------------------------------------------------+
| Saturday 5 December, 4:30 - 7:00 pm              |
| Currently: awaiting payment                      |
+--------------------------------------------------+
| Phone        [+20 ___________________]           |
|              [ Send code ]                       |
+--------------------------------------------------+
| (after code)                                     |
|          [ _ ][ _ ][ _ ][ _ ][ _ ][ _ ]          |
+--------------------------------------------------+
| This does not reserve the slot. If it becomes    |
| free we will message you, and the first person   |
| to complete a booking gets it.                   |
+--------------------------------------------------+

Subscribed
+--------------------------------------------------+
| We will message +20 1xx xxx xxxx if this slot    |
| becomes free.              [ Back to calendar ]  |
+--------------------------------------------------+
```

## Components

- Slot summary with current state
- Phone field
- Verification code input (from `phone-verification`)
- Explanatory note
- Subscribed confirmation
- Unsubscribe confirmation page (reached from the message link)

## States

| State | Description |
|---|---|
| Default | Slot summary and phone field |
| Loading | Button spinner while sending the code or subscribing |
| Empty | Slot no longer eligible (now free): message with a "Book it now" action; (now confirmed): message with "Back to calendar" |
| Error | Code delivery failed or subscription limit reached: inline message with venue contact |

## Interactions

- "Send code" requests a verification code and reveals the code input.
- Entering the code subscribes the phone to the slot and shows the confirmation.
- "Back to calendar" returns to the same day.
- The unsubscribe link in a message removes the subscription and shows a one-line confirmation.

## Responsive behavior

- Below `md`: bottom sheet over the calendar.
- `md` and up: centered dialog, 480px wide.

## Accessibility

- Presented as a dialog with a title; focus is trapped and returns to the "Notify me" button on close.
- The explanatory note is part of the dialog's description so it is read before the form.
- Phone and code inputs are `dir="ltr"`.
- Success is announced and focus moves to the confirmation.
