import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ANONYMOUS } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { BookingNotFound } from "@/components/booking/booking-not-found";
import { BookingStatus } from "@/components/booking/booking-status";
import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";
import { bookingReadOperations } from "@/ops/booking/read";

// The customer's private booking page (docs/features/booking-page). The link
// token is the key; the server renders the first status through the same
// operation the API uses (ADR-020), and the client half keeps it fresh. An
// unknown token is the page's empty moment, not a crash.

export const dynamic = "force-dynamic";

export default async function BookingPage({
  params,
}: PageProps<"/[locale]/booking/[token]">) {
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("BookingPage");
  const result = await bookingReadOperations.byToken(
    { token },
    createCallContext(ANONYMOUS),
  );

  // Only a broken service is a page error; every other failure is "not found".
  if (!result.ok && result.error.code === "INTERNAL") {
    throw new Error(`Booking read failed: ${result.error.code}`);
  }

  return (
    <>
      <SiteHeader locale={locale} />

      <main className="mx-auto max-w-[560px] px-6 pb-16">
        <h1 className="py-6 text-3xl font-bold md:text-4xl">{t("title")}</h1>
        {result.ok && result.data ? (
          <BookingStatus token={token} initial={result.data} />
        ) : (
          <BookingNotFound />
        )}
      </main>
    </>
  );
}
