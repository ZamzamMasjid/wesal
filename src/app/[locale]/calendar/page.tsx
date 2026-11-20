import { ArrowLeft } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ANONYMOUS } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { CalendarView } from "@/components/calendar/calendar-view";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cairoDay } from "@/lib/cairo-time";
import { firstDayOfMonth, lastDayOfMonth, monthOf } from "@/lib/calendar-grid";
import { runtime } from "@/lib/runtime";
import { calendarOperations } from "@/ops/calendar/availability";

// The public calendar (docs/features/public-calendar). The current month is
// rendered on the server through the same operation the API uses (ADR-020), so
// the first paint already has the states; the client half polls for changes.

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  params,
}: PageProps<"/[locale]/calendar">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Calendar");
  const home = await getTranslations("Home");
  const other = routing.locales.find((l) => l !== locale) ?? locale;

  const today = cairoDay(runtime.clock.now());
  const month = monthOf(today);
  const result = await calendarOperations.availability(
    { from: firstDayOfMonth(month), to: lastDayOfMonth(month) },
    createCallContext(ANONYMOUS),
  );
  if (!result.ok) {
    // The locale error boundary shows the static fallback notice.
    throw new Error(`Availability failed: ${result.error.code}`);
  }

  return (
    <>
      <header className="mx-auto flex h-20 max-w-content items-center justify-between px-6">
        <Link
          href="/"
          aria-label={t("homeLabel")}
          className="text-4xl leading-none font-bold text-brand"
        >
          {home("heading")}
        </Link>
        <nav
          aria-label={t("navLabel")}
          className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-md"
        >
          <Link
            href="/calendar"
            locale={other}
            className="flex h-(--size-touch-dense) items-center rounded-full px-3 text-sm font-medium hover:bg-fill"
          >
            {t("language")}
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="mx-auto max-w-content px-6 pb-16">
        <div className="py-6 md:pb-8">
          <Link
            href="/"
            className="inline-flex min-h-(--size-touch) items-center gap-2 text-sm font-medium text-muted hover:text-brand"
          >
            <ArrowLeft
              aria-hidden="true"
              className="size-4 rtl:-scale-x-100"
              strokeWidth={1.75}
            />
            {t("backHome")}
          </Link>
          <h1 className="text-3xl font-bold md:text-5xl">{t("title")}</h1>
          <p className="text-muted">{t("intro")}</p>
        </div>

        <CalendarView initial={result.data} />
      </main>
    </>
  );
}
