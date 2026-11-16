// Light/dark theme. The theme is the `data-theme` attribute on <html>, which the
// design tokens key off (ADR-024). Light is the default and dark is an optional
// choice remembered in this browser (docs/design/system.md); the OS preference
// is not followed.

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "wesal-theme";

/** Fired on `window` when the theme changes in this tab. */
export const THEME_CHANGE_EVENT = "wesal-theme-change";

/** Anything other than a stored "dark" is light, so a bad value cannot break the page. */
export function parseTheme(value: string | null | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/**
 * Runs in <head>, before first paint, so a returning dark-mode visitor never
 * sees a flash of the light theme. Written out as a string because it must not
 * wait for React. Keep it in step with parseTheme and THEME_STORAGE_KEY.
 */
export const themeInitScript = `(function(){var t="light";try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")t="dark"}catch(e){}document.documentElement.dataset.theme=t})()`;

/** Reads the theme currently applied to the document. */
export function readAppliedTheme(): Theme {
  return parseTheme(document.documentElement.dataset.theme);
}

/** Applies and remembers a theme. Storage can be unavailable (private mode); the theme still applies. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Not remembered, still applied for this visit.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
