---
id: review-queue
type: view
title: Payment Review
last_modified: 2026-11-15
feature: payment-review
mockup: none
---

# Payment Review

## Purpose

Staff see which payment proofs are waiting, open one, compare the screenshot with their wallet, and confirm or reject. Designed phone-first.

## Layout

Queue, and a review page per booking.

```
Queue
+--------------------------------------------------+
| Review (3)                                       |
+--------------------------------------------------+
| ! URGENT  Funeral, tomorrow 10:00 am             |
|   Name ...        Deposit 500 EGP    waiting 4m  |
+--------------------------------------------------+
|   Wedding, Sat 5 Dec 2:00 pm                     |
|   Name ...        Deposit 2,500 EGP  waiting 1h  |
+--------------------------------------------------+
|   Nikah, Fri 11 Dec 4:30 pm                      |
|   Name ...        Deposit 750 EGP    waiting 2h  |
+--------------------------------------------------+
| [Review] [Bookings] [More]                       |  tab bar
+--------------------------------------------------+

Review page
+--------------------------------------------------+
| < Queue                 W-7K3M9QXT               |
+--------------------------------------------------+
| Expected deposit                                 |
|            2,500 EGP                             |
| Wedding, Sat 5 Dec, 2:00 - 4:00 pm               |
| Name ...   Phone ...  [call]                     |
+--------------------------------------------------+
|                                                  |
|        [ screenshot, tap to enlarge ]            |
|                                                  |
+--------------------------------------------------+
|   [ Reject ]              [ Confirm ]            |  sticky
+--------------------------------------------------+
```

## Components

- Queue list with urgent badge and waiting time
- Review header with expected deposit
- Booking summary with a call link
- Screenshot viewer (full-screen dialog with zoom)
- Sticky action bar
- Confirm dialog, reject dialog with reasons
- Dashboard shell navigation (from `staff-access`)

## States

| State | Description |
|---|---|
| Default | Queue sorted urgent first, then oldest first |
| Loading | Skeleton items; screenshot placeholder at final size |
| Empty | "No payments to review" |
| Error | Screenshot unavailable (purged or missing): notice in place of the image, actions still work. Already decided: message with current status and a link back |

## Interactions

- Tapping a queue item opens its review page; a staff alert link opens it directly.
- Tapping the screenshot opens it full screen with pinch zoom.
- Confirm asks once, then marks the booking confirmed and opens the next item.
- Reject asks for a reason, then frees the slot and opens the next item.
- The queue refreshes on focus and every 30 seconds.

## Responsive behavior

- Below `md`: as sketched; actions in a sticky bottom bar within thumb reach.
- `md` and up: queue on the start side, review page beside it; actions at the top of the review pane.

## Accessibility

- The queue is a list of links; each name includes occasion, date and waiting time, and "urgent" where it applies.
- The screenshot has alternative text ("Payment screenshot for booking W-…"); the expected deposit is real text, not part of the image.
- Dialogs focus the safe action first; Reject's destructive button names the action.
- After a decision, focus moves to the next item's heading, or to the empty state.
