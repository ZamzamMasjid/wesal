import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ANONYMOUS } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { BookingForm } from "@/components/booking/booking-form";
import { SiteHeader } from "@/components/site-header";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getDb } from "@/db/client";
import { isValidDay } from "@/lib/cairo-time";
import { calendarOperations } from "@/ops/calendar/availability";
import { occasionOperations } from "@/ops/venue/occasions";
import { loadSettings } from "@/ops/venue/settings";

// The booking form (docs/features/booking-hold, view booking-form). The slot
// comes from the calendar in the URL; this page refuses to render a form for a
// slot that is closed, gone or inside the near-slot cutoff, so the customer is
// sent back to the calendar instead of filling a form that cannot succeed.

export const dynamic = "force-dynamic";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export default async function BookPage({
  params,
  searchParams,
}: PageProps<"/[locale]/book">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Booking");
  const search = await searchParams;
  const text = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : "";
  const day = text(search.day);
  const start = text(search.start);
  const end = text(search.end);
  const requestedOccasion = Number(text(search.occasion));
  const occasionId =
    Number.isInteger(requestedOccasion) && requestedOccasion > 0
      ? requestedOccasion
      : undefined;

  if (!isValidDay(day)) return redirect({ href: "/calendar", locale });
  const calendarHref = `/calendar?day=${day}`;
  if (!TIME.test(start) || !TIME.test(end) || start >= end) {
    return redirect({ href: calendarHref, locale });
  }

  const ctx = createCallContext(ANONYMOUS);
  const [availability, occasions, settings] = await Promise.all([
    calendarOperations.availability({ from: day, to: day }, ctx),
    occasionOperations.listPublic({}, ctx),
    loadSettings(getDb()),
  ]);

  const slot = availability.ok
    ? availability.data.days[0]?.slots.find(
        (entry) => entry.start === start && entry.end === end,
      )
    : undefined;
  if (!availability.ok || slot?.action !== "book") {
    return redirect({ href: calendarHref, locale });
  }
  if (!occasions.ok || occasions.data.occasions.length === 0) {
    return redirect({ href: calendarHref, locale });
  }

  return (
    <>
      <SiteHeader locale={locale} />

      <main className="mx-auto max-w-[560px] px-6 pb-16">
        <h1 className="py-6 text-3xl font-bold md:text-4xl">{t("title")}</h1>
        <BookingForm
          day={day}
          start={start}
          end={end}
          occasions={occasions.data.occasions}
          depositPercent={settings.depositPercent}
          holdMinutes={settings.holdMinutes}
          initialOccasionId={occasionId}
        />
      </main>
    </>
  );
}
