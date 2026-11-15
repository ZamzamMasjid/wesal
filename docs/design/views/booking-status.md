---
id: booking-status
type: view
title: Booking Page
last_modified: 2026-11-15
feature: booking-page
mockup: none
---

# Booking Page

## Purpose

The customer's private page for one booking: how to pay, how long is left, uploading proof, and the current status. Reached by the link sent to their phone or by booking ID.

## Layout

The top block changes with status; the summary below is constant.

```
Held (awaiting payment)
+--------------------------------------------------+
|  Awaiting payment                                |
|  Transfer the deposit and upload the screenshot  |
|                  17:42                           |  countdown
+--------------------------------------------------+
|  Deposit            2,500 EGP                    |
|  Vodafone Cash      010 xxxx xxxx      [copy]    |
|  InstaPay           name@instapay      [copy]    |
+--------------------------------------------------+
|        [ Upload transfer screenshot ]            |
|        or send it on WhatsApp                    |
+--------------------------------------------------+
|  Booking  W-7K3M9QXT                   [copy]    |
|  Wedding, Saturday 5 December, 2:00 - 4:00 pm    |
|  Name: ...                                       |
+--------------------------------------------------+
|  Need help?  [ Call ]  [ WhatsApp ]              |
+--------------------------------------------------+

Awaiting review:  status block = "We received your proof. The venue
                  will confirm shortly." (no countdown)
Confirmed:        framed confirmation card, remaining balance due
                  at the venue
Rejected/expired/cancelled: what happened, [ Book again ]
```

## Components

- Status header with badge
- Countdown
- Transfer details with copy buttons
- Upload area and WhatsApp alternative (from `payment-proof`)
- Booking summary
- Confirmation card
- Contact footer

## States

| State | Description |
|---|---|
| Default | Layout for the booking's current status |
| Loading | Summary skeleton; countdown appears only once the real deadline is known |
| Empty | Unknown link or ID: "We could not find this booking", find-my-booking form, contact |
| Error | Status refresh failed: last known status with a "not live" note and Retry |

## Interactions

- Copy buttons copy the number, address or booking ID.
- Upload opens the gallery, shows a preview, then sends; the status block changes to awaiting review.
- The page polls for status and updates in place.
- At zero the page switches to expired and offers "Book again".
- "Book again" opens the calendar.

## Responsive behavior

- Below `md`: single column; the upload button is full width and reachable without scrolling on a 360px screen.
- `md` and up: centered at 560px.
- The confirmed card prints cleanly on one page.

## Accessibility

- The countdown is a timer region announced at sensible intervals (each minute, then the last ten seconds), not every second.
- Status changes are announced assertively once.
- Copy buttons name what they copy ("Copy Vodafone Cash number").
- Numbers and the booking ID are `dir="ltr"`.
- Color changes on the countdown are accompanied by text ("less than 5 minutes left").
