import { ArrowLeft } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ANONYMOUS } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { CalendarView } from "@/components/calendar/calendar-view";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cairoDay, isValidDay } from "@/lib/cairo-time";
import { firstDayOfMonth, lastDayOfMonth, monthOf } from "@/lib/calendar-grid";
import { runtime } from "@/lib/runtime";
import { calendarOperations } from "@/ops/calendar/availability";

// The public calendar (docs/features/public-calendar). The current month is
// rendered on the server through the same operation the API uses (ADR-020), so
// the first paint already has the states; the client half polls for changes.

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  params,
  searchParams,
}: PageProps<"/[locale]/calendar">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Calendar");
  const requested = (await searchParams).day;
  const requestedDay =
    typeof requested === "string" && isValidDay(requested)
      ? requested
      : undefined;

  const today = cairoDay(runtime.clock.now());
  const month = monthOf(requestedDay ?? today);
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
      <SiteHeader locale={locale} />

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

        <CalendarView initial={result.data} initialDay={requestedDay} />
      </main>
    </>
  );
}
