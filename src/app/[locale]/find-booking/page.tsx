import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { FindBookingForm } from "@/components/booking/find-booking-form";
import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";

// "Find my booking" (docs/features/booking-page): the customer lost the link
// and types the short booking ID instead. There is deliberately no lookup by
// phone number.

export const dynamic = "force-dynamic";

export default async function FindBookingPage({
  params,
}: PageProps<"/[locale]/find-booking">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("BookingPage.find");

  return (
    <>
      <SiteHeader locale={locale} />

      <main className="mx-auto max-w-[480px] px-6 pb-16">
        <h1 className="py-6 text-3xl font-bold md:text-4xl">{t("title")}</h1>
        <p className="mb-6 text-muted">{t("intro")}</p>
        <section className="rounded-lg bg-surface p-6 shadow-md">
          <FindBookingForm />
        </section>
      </main>
    </>
  );
}
