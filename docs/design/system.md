---
id: design-system
type: design-system
title: Design System
last_modified: 2026-11-26
---

# Design System

The visual language. Exact values live in `docs/design/tokens.css`, which is authoritative; this document says what each token is for. Every component is rendered in `docs/design/mockups/_gallery.html`. Per-feature conventions live in feature design docs; per-page specifics live in view docs and their mockups.

## Design philosophy

Warm, soft and hospitable ("Waraq", paper). The venue hosts weddings and funerals alike, so the interface is dignified and calm, never festive. Photography of the venue carries the emotion; the interface around it is warm paper: sand backgrounds, off-white cards, one oxblood brand color and an olive secondary.

Shape does the work that lines usually do. Cards are separated from the page by a soft shadow, not a border. Controls are pills. Corners are large. There is no ornament: no geometric borders, dividers or patterns.

One type family, Cairo, carries Arabic and English, headings and body. Hierarchy comes from size and weight.

Arabic is the primary language. Layouts are designed right-to-left first and mirrored for English, never the reverse. The public site is generous and touch-friendly; the dashboard uses the same language at a comfortable, plainer density. Motion is measured: it confirms an action or eases a transition and is never decoration.

## Color

Light is the default theme; dark is an optional toggle, set as `data-theme="dark"` on the root element. Token names below omit the `--color-` prefix.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F3EDE4` | `#1A1513` | Page background |
| `surface` | `#FFFDF9` | `#241D1A` | Cards, dialogs, inputs |
| `fill` | `#EAE2D6` | `#2E2622` | Secondary buttons, confirmed and closed slots, skeletons |
| `fg` | `#2A211C` | `#F0E8DE` | Body text |
| `muted` | `#6A5E55` | `#B0A297` | Secondary text, captions |
| `border` | `#E2D7C9` | `#3A2F2A` | Input outlines, table rules. Cards use shadow, not border |
| `brand` | `#6B2737` | `#E3A1AE` | Primary buttons, links, active states |
| `brand-hover` | `#5A1F2D` | `#EDB7C1` | Primary button hover |
| `brand-fg` | `#FFFFFF` | `#2A1016` | Text and icons on `brand` and on `danger` |
| `brand-soft` | `#F1E1DF` | `#3A2226` | Tinted panels, awaiting-review badge, active navigation item |
| `accent` | `#56602F` | `#B9C48A` | Free slots, "has free slots" marker |
| `accent-soft` | `#E9EBD9` | `#2B2E1F` | Bookable slot rows, free badge |
| `danger` | `#A3312A` | `#E2776F` | Errors, reject, cancel |
| `danger-soft` | `#F6E0DC` | `#3B211E` | Error panels, rejected badge |
| `warning` | `#855A00` | `#E0B04A` | Awaiting payment, countdown near zero |
| `warning-soft` | `#F8EBCB` | `#33290F` | Awaiting-payment badge, conflict panel |
| `success` | `#2F6B45` | `#7FC497` | Confirmed, in the dashboard and in toasts |
| `success-soft` | `#DDEBDD` | `#1E2E22` | Confirmed badge in the dashboard |
| `focus` | `#6B2737` | `#E3A1AE` | Focus ring |
| `overlay` | `rgb(42 33 28 / 0.5)` | `rgb(0 0 0 / 0.6)` | Dialog backdrop |
| `photo-fg` | `#FFFDF9` | `#FFFDF9` | Text and icons laid directly over a photograph |
| `photo-scrim` | `#1A1513` | `#1A1513` | Gradient that keeps copy on a photograph readable |
| `logo-bg` | `#6B2737` | `#6B2737` | The fixed wordmark plaque, in both themes |
| `logo-fg` | `#FFFDF9` | `#FFFDF9` | The arch and name on that plaque |

Slot states have fixed semantic colors, always paired with a text label and an icon, never color alone:

| State | Badge | Icon |
|---|---|---|
| Free | `accent` on `accent-soft` (on `surface` inside a bookable row) | circle |
| Awaiting payment | `warning` on `warning-soft` | hourglass |
| Awaiting review | `brand` on `brand-soft` | eye |
| Confirmed | `muted` on `fill` | circle-check |
| Closed | `muted` on `fill`, struck label | lock |

A bookable slot row has an `accent-soft` background; a taken row sits on `bg` with its time in `muted`. In the dashboard, where confirmed is the good outcome, the confirmed badge is `success` on `success-soft`, and rejected or cancelled is `danger` on `danger-soft`.

## Typography

| Role | Family | Token |
|---|---|---|
| Everything, Arabic and English | Cairo, bundled at `docs/design/fonts/` (SIL OFL) | `--font-sans` |
| Booking IDs | System monospace | `--font-mono` |

| Token | Size | Use |
|---|---|---|
| `--text-xs` | 12px | Table headers, weekday names |
| `--text-sm` | 14px | Captions, badges, dashboard text |
| `--text-base` | 16px | Body; the minimum on public pages |
| `--text-lg` | 18px | Lead paragraphs, slot times |
| `--text-xl` | 20px | Card headings |
| `--text-2xl` | 24px | Day heading, occasion names |
| `--text-3xl` | 30px | Prices; section headings on phones |
| `--text-4xl` | 36px | Wordmark; the venue name on phones |
| `--text-5xl` | 48px | Section headings on public pages |
| `--text-6xl` | 64px | The venue name |

Body line-height is 1.8 (`--leading-body`); headings 1.3 (`--leading-heading`). Weights: 400 body, 500 labels and badges, 600 buttons, prices and slot times, 700 headings.

Numbers shown to customers (prices, times, countdown, booking ID) use Western digits in both languages for clarity when read over the phone. They are set with tabular figures and isolated left-to-right. A time range is two separate numbers around a dash, so the start time sits on the reading-start side in both directions.

## Spacing

Base unit 4px. Tokens `--space-1` to `--space-24` cover 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 and 96px.

Public pages: section spacing 96px (64px on phones), card padding 24px, minimum touch target 48px (`--size-touch`). Dashboard: section padding 24px, card padding 16px, row height 48px, touch target 40px (`--size-touch-dense`).

Layout uses logical properties only (`ps`, `pe`, `ms`, `me`, `start`, `end`) so one stylesheet serves both directions. Content width: 1120px maximum on public pages (`--size-content`), full width with a 240px side navigation in the dashboard (`--size-sidenav`).

## Shape and elevation

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | Small elements inside dense UI |
| `--radius-md` | 16px | Dashboard cards, inline panels, toasts, code boxes |
| `--radius-lg` | 24px | Public cards, dialogs, gallery tiles |
| `--radius-xl` | 32px | Hero photograph |
| `--radius-full` | 999px | Buttons, inputs, badges, slot rows, navigation items |
| `--shadow-sm` | subtle | Tables, small chips over photographs |
| `--shadow-md` | soft, wide | Cards |
| `--shadow-lg` | deep | Dialogs, toasts, the sticky contact bar |

On phones a slot row that wraps to two lines uses `--radius-lg`, since a pill cannot hold two lines.

## Motion

`--duration-fast` (150ms) for hover and press; `--duration-base` (250ms) for image zoom and panels; easing `--ease-out`. `prefers-reduced-motion` disables transitions and skeleton animation; the countdown still updates as text.

## Breakpoints

Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px. The public site is designed at 360px first, since most customers arrive on phones. The dashboard is designed for phone and laptop equally: the owner confirms payments from a phone.

## Iconography

Lucide, stroke width 1.75. 20px in UI, 16px inline with text and in badges, 24px in navigation. Directional icons (arrows, chevrons) flip in RTL; non-directional icons do not. Icons accompany labels; an icon-only button always has an accessible name.

## Wordmark and icon

The wordmark is the Arabic name **وصال** in Cairo ExtraBold, cream on a fixed oxblood plaque, beside a mihrab-arch mark whose niche is cut out of it. The mark is one shape, so it stays readable at 16px. The plaque uses the fixed `logo-bg` and `logo-fg` tokens: it is identical on every page and in both themes; the page behind it changes, not the logo.

- Header lockup: a `logo-bg` pill with the mark at 24px on phones and 28px from `md`, then the name; 8px gap and a thin `logo-fg/15` ring for the hero photograph.
- Tab and app icon: the same arch in cream on a `logo-bg` rounded square (`public/favicon.svg`, with 16/32/180/192/512 PNGs). The manifest name and the Apple web-app title are both **وصال**.
- Do not theme the plaque, invert it over a photograph, or put the full word inside the favicon; at tab size those changes make the mark read differently.

## Accessibility baseline

WCAG AA.

- Text contrast at least 4.5:1 (3:1 for text 24px and larger). Every text color above meets this on the backgrounds it is paired with. `border` is never used for text.
- Visible focus ring: 2px `focus` with 2px offset, in both themes.
- Everything operable by keyboard; focus order follows reading order in the active direction.
- Every form field has a visible label; errors are announced and linked to their field.
- Slot states and booking statuses are conveyed by text and icon, not color alone.
- `prefers-reduced-motion` is honored (see Motion).
- `lang` and `dir` attributes are set per locale; mixed-direction content (phone numbers, booking IDs, times) is isolated with `dir="ltr"`.

## Implementation

The app consumes these tokens as CSS variables; see ADR-024.

The wordmark mark is `src/components/wesal-mark.tsx`. The tab and app icon use the same arch paths in `public/favicon.svg`, with generated `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png` and `icon-512.png`; `public/site.webmanifest` names the installed app **وصال**.
