---
id: design-patterns
type: design-patterns
title: Interaction Patterns
last_modified: 2026-11-15
---

# Interaction Patterns

Reusable interaction patterns. Per-page interactions live in view design docs. Components come from shadcn/ui on Radix; the conventions below say how they are used here.

## Modals and dialogs

Radix Dialog. Used for confirmations with consequences (confirm payment, reject, cancel booking), for the add-booking form in the dashboard, and for the full-size screenshot viewer. Focus is trapped, Escape and the backdrop close non-destructive dialogs, and focus returns to the trigger.

Destructive actions (reject, cancel) use an alert dialog: no backdrop dismissal, the safe action is focused by default, and the destructive button names the action ("Reject booking"), not "OK". On phones, dialogs become bottom sheets.

The public booking flow uses full pages, not dialogs, so the browser back button and a refresh behave predictably.

## Toasts and notifications

Sonner. Bottom-center on phones, bottom-end on desktop (follows direction). Success toasts dismiss after 4 seconds; errors stay until dismissed. Toasts confirm completed staff actions ("Booking confirmed"). They are never the only place an error appears: validation and conflict errors are shown inline where the user is looking.

The slot-conflict message ("this slot is being booked by someone else") and the code-delivery failure are full inline panels with a next step, not toasts.

## Forms

react-hook-form with zod schemas shared with the API. Labels sit above fields. Validation runs on blur and on submit; errors appear under the field in `danger` with an icon and are linked by `aria-describedby`. The submit button shows a spinner and is disabled while the request is in flight; double submission is impossible.

Phone numbers are entered left-to-right in both languages, with the Egyptian country code prefilled. Prices and percentages use numeric keyboards. Verification codes use a six-box one-time-code input with `autocomplete="one-time-code"`.

Dashboard settings forms save explicitly with a Save button and warn on leaving with unsaved changes.

## Lists and tables

Dashboard lists (bookings, review queue, staff, occasions) are tables on desktop and stacked cards on phones. Default sort is by event date, soonest first; the review queue sorts by upload time, oldest first, with urgent bookings pinned on top. Filters (date range, status, source) sit above the list and are reflected in the URL. Pagination is 25 per page with simple next and previous; at this scale infinite scroll is unnecessary. No bulk actions in v1: every confirm or reject is a deliberate single action.

Status is shown as a labelled badge using the slot-state colors in `docs/design/system.md`.

## Drag and drop

Used in one place: ordering photos and videos in the content editor. Items also have move-up and move-down buttons, which are the keyboard and screen-reader path. Not used elsewhere in v1.

## Keyboard

No global single-key shortcuts on the public site. In the dashboard, `/` focuses the bookings search and Escape closes the topmost dialog. Tab order follows the visual order in the active direction. The calendar grid supports arrow-key navigation between days, with Enter to open a day.

## Loading and skeletons

Under 200ms: show nothing. 200ms to 1s: skeleton matching the final layout. Over 1s: skeleton plus a small spinner and, on the public site, a line of text. The calendar keeps showing the previous slot states while refreshing in the background; it never flashes empty. Uploads show a determinate progress bar.

The 20-minute countdown is rendered from the server-provided deadline, not a client timer start, so a refresh or a slow connection never shows more time than is really left.

## Empty states

Icon, one sentence, one action. Examples: review queue with nothing waiting ("No payments to review") with no action; bookings list with filters that match nothing, with a "Clear filters" action; a calendar day with no slots ("The venue is not available on this day") with the venue's phone and WhatsApp.
