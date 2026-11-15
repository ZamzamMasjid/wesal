---
id: booking-form
type: view
title: Book a Slot
last_modified: 2026-11-15
feature: booking-hold
mockup: none
---

# Book a Slot

## Purpose

The customer confirms what they are booking, says who they are, verifies their phone and creates the 20-minute hold.

## Layout

One column, two steps on the same page.

```
Step 1: details
+--------------------------------------------------+
| < Change slot                                    |
| Saturday 5 December, 2:00 - 4:00 pm              |
+--------------------------------------------------+
| Occasion                                         |
|  ( ) Wedding ............... 10,000 EGP          |
|  ( ) Engagement ............  6,000 EGP          |
|  ( ) Nikah .................  3,000 EGP          |
|  ( ) Funeral ...............  2,000 EGP          |
+--------------------------------------------------+
| Deposit to transfer now (25%):   2,500 EGP       |
+--------------------------------------------------+
| Your name      [______________________]          |
| Phone          [+20 ___________________]         |
+--------------------------------------------------+
| What happens next                                |
|  1. We send a code to your phone                 |
|  2. You have 20 minutes to transfer the deposit  |
|  3. Upload a screenshot of the transfer          |
|            [ Book now ]                          |
+--------------------------------------------------+

Step 2: code
+--------------------------------------------------+
| We sent a code to +20 1xx xxx xxxx  Change number|
|          [ _ ][ _ ][ _ ][ _ ][ _ ][ _ ]          |
|          Resend code in 0:45                     |
+--------------------------------------------------+
```

## Components

- Slot summary with "Change slot"
- Occasion picker (radio cards)
- Cost summary
- Details form (name, phone)
- "What happens next" list
- Verification code step (from `phone-verification`)
- Slot-conflict panel
- Delivery-failure panel

## States

| State | Description |
|---|---|
| Default | Step 1 with the slot carried from the calendar; occasion preselected if chosen on the landing page |
| Loading | Submit button spinner; fields disabled |
| Empty | No slot in the URL: redirect to the calendar |
| Error | Field errors inline; slot taken: slot-conflict panel; code not deliverable: delivery-failure panel with venue contact; phone already has a held booking: link to find it |

## Interactions

- Choosing an occasion updates the deposit amount.
- "Book now" validates, requests a code and shows step 2.
- Entering the sixth digit submits; on success the booking page opens.
- "Change number" returns to step 1 with contents kept.
- "Choose another slot" in the conflict panel returns to the calendar on the same day.

## Responsive behavior

- Below `md`: single column, full-width button fixed above the keyboard.
- `md` and up: form centered at 560px; the slot summary stays pinned at the top while scrolling.

## Accessibility

- The occasion picker is a radio group with a legend; each option's name includes its price.
- Step changes move focus to the new step's heading and are announced.
- The code input is one logical field for assistive technology, with a clear label.
- Errors are linked to their fields and summarised at the top of the form on submit.
- Phone and code inputs are `dir="ltr"` in both languages.
