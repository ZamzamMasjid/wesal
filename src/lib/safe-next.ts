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
