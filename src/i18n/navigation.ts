import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware Link, redirect, usePathname and useRouter. Use these instead of
// the next/link and next/navigation versions so links keep the visitor's locale.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
