---
id: staff-access
type: feature-design
title: Staff Access — Design
last_modified: 2026-11-15
feature: staff-access
---

# Staff Access — Design

> UI specifics for this feature. Generic design tokens and patterns live in `docs/design/system.md` and `docs/design/patterns.md`. Per-page layouts live in `docs/design/views/`.

## Visual conventions specific to this feature

This feature owns the dashboard shell, which every back-office screen sits in. The shell is plain: `surface` navigation, no ornament, comfortable density. It follows the dashboard language's direction, with navigation on the start side.

## Components

- **Login form** — login and password, show-password toggle, language switch.
- **Dashboard shell** — side navigation on desktop (Review, Bookings, and for the owner Schedule, Settings, Content, Staff), bottom tab bar on phones with Review and Bookings first; a badge on Review counts waiting proofs.
- **User menu** — name, role, language, theme, notification settings, log out.
- **Staff table** — name, login, role, active toggle, reset password.
- **Add staff dialog** — name, login, initial password, notification phone.

## States

| State | Behavior |
|---|---|
| Empty | Staff list with only the owner: "Add staff who can confirm payments and enter bookings" |
| Loading | Skeleton rows; the shell renders immediately |
| Error | Wrong credentials: one generic message under the form. Too many attempts: wait message. Forbidden action: toast and no change |

## Interactions

Navigation items a staff role cannot use are not shown. Arriving from a deep link while logged out shows the login form and then continues to the link. Disabling a staff account asks for confirmation and takes effect immediately.
