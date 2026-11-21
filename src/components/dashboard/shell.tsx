"use client";

import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Eye,
  Home,
  Image as ImageIcon,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { fetchReviewQueue } from "@/lib/review-api";

import { navFor, type NavItem } from "./nav";

const icons = {
  home: Home,
  review: Eye,
  bookings: CalendarDays,
  content: ImageIcon,
  schedule: CalendarClock,
  settings: Settings,
  staff: Users,
  reports: BarChart3,
} as const;

interface ShellProps {
  user: { name: string; role: "owner" | "staff" };
  children: React.ReactNode;
}

const REVIEW_POLL_MS = 30_000;

/**
 * How many payments are waiting, for the Review badge. Refreshed on focus and
 * every 30 seconds, the same cadence as the queue itself (ADR-014's pattern).
 */
function useReviewCount(): number {
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    const result = await fetchReviewQueue();
    if (result.ok && result.data) setCount(result.data.items.length);
  }, []);

  useEffect(() => {
    // The badge is refreshed from the network; the state update follows the answer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const poll = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(poll, REVIEW_POLL_MS);
    window.addEventListener("focus", poll);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", poll);
    };
  }, [refresh]);

  return count;
}

/**
 * The frame every back-office screen sits in: side navigation on desktop (on
 * the start side, so it follows the language direction), a bottom tab bar on
 * phones. The server decides access; this only hides what a role cannot use.
 */
export function DashboardShell({ user, children }: ShellProps) {
  const t = useTranslations("Dashboard");
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const other = routing.locales.find((l) => l !== locale) ?? locale;
  const items = navFor(user.role);
  const reviewCount = useReviewCount();

  async function logout() {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    } finally {
      router.replace("/dashboard/login");
      router.refresh();
    }
  }

  const link = (item: NavItem, compact: boolean) => {
    const Icon = icons[item.label];
    const active =
      item.href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(item.href);
    const size = compact
      ? "flex flex-1 flex-col items-center gap-1 py-2 text-xs "
      : "flex h-(--size-touch-dense) items-center gap-3 rounded-full px-4 text-sm font-medium ";
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={
          size + (active ? "bg-brand-soft text-brand" : "text-fg hover:bg-fill")
        }
      >
        <Icon className="size-5" aria-hidden />
        {t(`nav.${item.label}`)}
        {item.label === "review" && reviewCount > 0 && (
          <>
            <span
              aria-hidden
              className="ms-auto min-w-5 rounded-full bg-brand px-1.5 text-center text-xs font-semibold text-brand-fg tabular-nums"
            >
              {reviewCount}
            </span>
            <span className="sr-only">
              {t("nav.reviewBadge", { count: reviewCount })}
            </span>
          </>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-(--size-sidenav) shrink-0 flex-col gap-4 bg-surface p-4 shadow-sm md:flex">
        <span className="px-4 text-2xl font-bold text-brand">وصال</span>
        <nav aria-label={t("nav.label")} className="flex flex-col gap-1">
          {items.map((i) => link(i, false))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-2 px-4 md:px-6">
          <span className="text-xl font-bold text-brand md:hidden">وصال</span>
          <div
            className="ms-auto flex items-center gap-1 rounded-full bg-surface p-1 shadow-md"
            role="group"
            aria-label={t("menu.account")}
          >
            <span className="hidden px-3 text-sm sm:block">
              {user.name}
              <span className="ms-2 text-muted">
                {t(`menu.role.${user.role}`)}
              </span>
            </span>
            <Link
              href={pathname}
              locale={other}
              className="flex h-(--size-touch-dense) items-center rounded-full px-3 text-sm hover:bg-fill"
            >
              {t("menu.language")}
            </Link>
            <ThemeToggle />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-(--size-touch-dense) rounded-full"
              aria-label={t("menu.logout")}
              onClick={logout}
            >
              <LogOut className="size-5" aria-hidden />
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-content flex-1 p-4 pb-24 md:p-6">
          {children}
        </main>
        <nav
          aria-label={t("nav.label")}
          className="fixed inset-x-0 bottom-0 flex bg-surface shadow-lg md:hidden"
        >
          {items.map((i) => link(i, true))}
        </nav>
      </div>
    </div>
  );
}
