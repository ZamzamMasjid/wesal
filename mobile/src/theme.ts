// The same "Waraq" palette as the website (docs/design/tokens.css), so the app
// reads as the same venue. Screens use logical layout helpers for RTL.

export const colors = {
  bg: "#F3EDE4",
  surface: "#FFFDF9",
  fill: "#EAE2D6",
  fg: "#2A211C",
  muted: "#6A5E55",
  border: "#E2D7C9",
  brand: "#6B2737",
  brandHover: "#5A1F2D",
  brandFg: "#FFFFFF",
  brandSoft: "#F1E1DF",
  accent: "#56602F",
  accentSoft: "#E9EBD9",
  danger: "#A3312A",
  dangerSoft: "#F6E0DC",
  warning: "#855A00",
  warningSoft: "#F8EBCB",
  success: "#2F6B45",
  successSoft: "#DDEBDD",
} as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const shadow = {
  shadowColor: "#2A211C",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

/** Touch targets stay at least 48dp (mobile-home.md § Accessibility). */
export const touch = { minHeight: 48, minWidth: 48 } as const;
