const FALLBACK = "/dashboard";

/**
 * Where to go after login. Only paths inside the dashboard are accepted, so a
 * crafted `?next=` can never send a staff member to another site.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return FALLBACK;
  // "/dashboard" itself, or "/dashboard" followed by a path, query or fragment.
  if (!/^\/dashboard(?:[/?#].*)?$/.test(value)) return FALLBACK;
  // No protocol-relative tricks and no backslashes (browsers read them as "/").
  if (value.includes("//") || value.includes("\\")) return FALLBACK;
  return value;
}

/** The request header the proxy sets so server components know the page asked for. */
export const REQUEST_PATH_HEADER = "x-wesal-path";

/**
 * The path and query a visitor asked for, without the locale prefix, so it can
 * be handed to the login page as `next`. English lives under `/en`; Arabic has
 * no prefix. The language is not carried: login returns to the visitor's
 * current language through the locale-aware redirect.
 */
export function requestedPath(pathname: string, search: string): string {
  const stripped = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return stripped + search;
}
