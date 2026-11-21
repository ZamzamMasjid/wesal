export type NavItem = {
  href:
    | "/dashboard"
    | "/dashboard/review"
    | "/dashboard/bookings"
    | "/dashboard/content"
    | "/dashboard/staff"
    | "/dashboard/settings"
    | "/dashboard/schedule";
  label:
    | "home"
    | "review"
    | "bookings"
    | "content"
    | "staff"
    | "settings"
    | "schedule";
  /** Only owners see it; the server enforces the same rule. */
  ownerOnly?: boolean;
};

const ALL_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "home" },
  { href: "/dashboard/review", label: "review" },
  { href: "/dashboard/bookings", label: "bookings" },
  { href: "/dashboard/content", label: "content", ownerOnly: true },
  { href: "/dashboard/schedule", label: "schedule", ownerOnly: true },
  { href: "/dashboard/settings", label: "settings", ownerOnly: true },
  { href: "/dashboard/staff", label: "staff", ownerOnly: true },
];

/** The navigation a role may see. Items it cannot use are not shown. */
export function navFor(role: "owner" | "staff"): NavItem[] {
  return ALL_ITEMS.filter((item) => !item.ownerOnly || role === "owner");
}
