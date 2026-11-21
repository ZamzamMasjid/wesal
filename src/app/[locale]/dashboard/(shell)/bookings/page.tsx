import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { createCallContext } from "@/api/context";
import { BookingsView } from "@/components/bookings/bookings-view";
import { routing } from "@/i18n/routing";
import { parseFilters } from "@/lib/booking-admin-api";
import { cairoDay } from "@/lib/cairo-time";
import { adminBookingOperations } from "@/ops/booking/admin";
import { occasionOperations } from "@/ops/venue/occasions";

import { currentCaller } from "../../session";

// The bookings list (docs/features/booking-management, view bookings). Filters
// and the open booking come from the URL, so a filtered view is bookmarkable.
// The page calls the same operations as the JSON API (ADR-020); the operations
// decide access, not this page.

export const dynamic = "force-dynamic";

export default async function BookingsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/dashboard/bookings">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.bookings");
  const search = await searchParams;
  const filters = parseFilters(search);
  const bookingId =
    typeof search.booking === "string" ? search.booking.trim() : "";

  const ctx = createCallContext(await currentCaller());
  const [list, detail, occasions] = await Promise.all([
    adminBookingOperations.list(filters, ctx),
    bookingId
      ? adminBookingOperations.detail({ bookingId }, ctx)
      : Promise.resolve(null),
    occasionOperations.listPublic({}, ctx),
  ]);

  if (!list.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">
          {t("loadFailed")}
        </p>
      </section>
    );
  }

  return (
    <BookingsView
      initial={list.data}
      initialFilters={filters}
      initialDetail={detail?.ok ? detail.data : null}
      occasions={occasions.ok ? occasions.data.occasions : []}
      today={cairoDay(ctx.clock.now())}
    />
  );
}
