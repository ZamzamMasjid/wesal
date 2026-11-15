---
id: mobile-home
type: view
title: Mobile Home
last_modified: 2026-11-15
feature: customer-mobile-app
mockup: none
---

# Mobile Home

## Purpose

The mobile app's entry screen. The customer sees the venue, gets to the calendar in one tap, and returns to a booking they made on this device.

## Layout

```
+----------------------------+
| Wesal               [EN]   |
+----------------------------+
| +------------------------+ |
| | Your booking           | |   shown only if a booking
| | Wedding, Sat 5 Dec     | |   is stored on this device
| | Awaiting payment 17:42 | |
| +------------------------+ |
+----------------------------+
|  [ venue photograph ]      |
|  Wesal mosque and hall     |
|  [ Check availability ]    |
+----------------------------+
|  Gallery  > > >            |   horizontal scroll
+----------------------------+
|  Prices                    |
|  Wedding ...... 10,000 EGP |
|  ...                       |
+----------------------------+
|  [ Call ]   [ WhatsApp ]   |
+----------------------------+
| [Home] [Calendar] [Booking]|   tab bar
+----------------------------+
```

## Components

- Top bar with language switch
- Current booking card
- Hero with primary action
- Horizontal gallery with full-screen viewer
- Price list
- Contact buttons
- Bottom tab bar

## States

| State | Description |
|---|---|
| Default | Hero, gallery and prices; booking card when a booking is stored |
| Loading | Cached content shown first, refreshed in place; native skeletons on first launch |
| Empty | No stored booking: the booking card is not shown |
| Error | Offline: cached content with an "offline" banner; "Check availability" explains that a connection is needed |

## Interactions

- The booking card opens the booking screen.
- "Check availability" opens the Calendar tab.
- Tapping a gallery item opens the full-screen viewer with swipe.
- A price row opens the calendar with that occasion preselected.
- Pull to refresh reloads content and the booking status.

## Responsive behavior

- Phones: as sketched.
- Tablets: hero and gallery side by side in landscape; content capped in width.
- Layout mirrors fully for Arabic, including the gallery's scroll direction and tab order.

## Accessibility

- Follows platform accessibility: all controls have labels, touch targets are at least 48dp, and text respects the system font size.
- The countdown on the booking card is announced by minute.
- Gallery images carry the owner's alternative text.
- Screen reader order follows the visual order in the active direction.
