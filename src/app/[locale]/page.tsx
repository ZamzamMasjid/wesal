import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  MessageCircle,
  Phone,
} from "lucide-react";
import Image from "next/image";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ANONYMOUS } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { HomeGallery } from "@/components/home/home-gallery";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/db/client";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { dialable, whatsappUrl } from "@/lib/venue-contact";
import {
  formatPrice,
  heroMedia,
  localized,
  mediaAlternative,
  occasionName,
  paragraphs,
  policyRules,
  venueDescription,
} from "@/lib/site-text";
import { contentOperations } from "@/ops/content/content";
import { occasionOperations } from "@/ops/venue/occasions";
import { loadSettings } from "@/ops/venue/settings";

// The public home page (docs/features/landing-page, view home). Everything on it
// comes from content management and venue settings; nothing is hard-coded. It is
// rendered on the server through the same operations the API uses (ADR-020), so
// a slow phone gets the full page in the first response.

export const dynamic = "force-dynamic";

const primary =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-brand px-8 text-lg font-semibold text-brand-fg transition-colors hover:bg-brand-hover motion-reduce:transition-none";
const quiet =
  "inline-flex min-h-(--size-touch) items-center justify-center gap-2 rounded-full bg-fill px-6 font-semibold text-fg transition-colors hover:bg-border motion-reduce:transition-none";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Home");
  const ctx = createCallContext(ANONYMOUS);
  const [contentResult, occasionsResult, settings] = await Promise.all([
    contentOperations.read({}, ctx),
    occasionOperations.listPublic({}, ctx),
    loadSettings(getDb()),
  ]);
  if (!contentResult.ok) {
    // The locale error boundary shows the static fallback notice.
    throw new Error(`Content failed: ${contentResult.error.code}`);
  }
  if (!occasionsResult.ok) {
    throw new Error(`Occasions failed: ${occasionsResult.error.code}`);
  }

  const { content, media } = contentResult.data;
  const occasions = occasionsResult.data.occasions;
  const description = venueDescription(
    content.descriptionAr,
    content.descriptionEn,
    locale,
  );
  const rules = policyRules(
    localized(content.policyAr, content.policyEn, locale),
  );
  const hero = heroMedia(media);
  const gallery = hero ? media.filter((item) => item.id !== hero.id) : media;
  const phone = content.contactPhone.trim();
  const whatsapp = content.contactWhatsapp.trim();
  const hasContact = phone !== "" || whatsapp !== "";

  return (
    <>
      <SiteHeader locale={locale} path="/" findBooking />

      <main className="mx-auto max-w-content px-4 pb-24 md:px-6 md:pb-16">
        {hero && (
          <Image
            src={hero.url}
            alt={mediaAlternative(hero, locale) || t("mediaAltFallback")}
            width={1120}
            height={520}
            priority
            unoptimized
            sizes="(max-width: 1024px) 100vw, 1120px"
            className="h-[260px] w-full rounded-lg object-cover md:h-[480px] md:rounded-xl"
          />
        )}

        <section
          className="grid items-start gap-6 pt-8 md:grid-cols-[5fr_7fr] md:gap-12 md:pt-16"
          aria-labelledby="about-title"
        >
          <h1 id="about-title" className="text-4xl font-bold md:text-6xl">
            {t("venueName")}
          </h1>
          <div className="space-y-4 text-lg text-muted">
            {paragraphs(description).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        {gallery.length > 0 && <HomeGallery media={gallery} locale={locale} />}

        <section className="pt-16 md:pt-24" aria-labelledby="prices-title">
          <div className="grid items-start gap-6 md:grid-cols-[4fr_7fr] md:gap-12">
            <div>
              <h2 id="prices-title" className="text-3xl font-bold md:text-5xl">
                {t("prices")}
              </h2>
              <p className="mt-2 max-w-[34ch] text-muted">{t("priceNote")}</p>
              {occasions.length > 0 && (
                <p className="mt-6 rounded-lg bg-brand-soft p-4 text-sm md:p-5">
                  {t("depositNote", { percent: settings.depositPercent })}
                </p>
              )}
            </div>

            {occasions.length > 0 ? (
              <div>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {occasions.map((occasion) => (
                    <li key={occasion.id}>
                      <Link
                        href={`/calendar?occasion=${occasion.id}`}
                        className="flex h-full flex-col rounded-lg bg-surface p-6 shadow-md transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none"
                      >
                        <span className="line-clamp-2 text-2xl font-bold">
                          {occasionName(occasion, locale)}
                        </span>
                        <span className="mt-4 flex items-end justify-between gap-3">
                          <span className="text-3xl font-semibold text-brand">
                            <bdi dir="ltr" className="tabular-nums">
                              {formatPrice(occasion.priceEgp)}
                            </bdi>
                            <small className="ms-1 text-sm font-normal text-muted">
                              {t("currency")}
                            </small>
                          </span>
                          <span
                            aria-hidden="true"
                            className="inline-flex size-(--size-touch-dense) items-center justify-center rounded-full bg-fill"
                          >
                            <ArrowLeft className="size-5 rtl:-scale-x-100" />
                          </span>
                        </span>
                        <span className="sr-only">
                          {t("checkAvailability")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link href="/calendar" className={primary}>
                    <CalendarDays
                      aria-hidden="true"
                      className="size-5"
                      strokeWidth={1.75}
                    />
                    {t("checkAvailability")}
                  </Link>
                  <span className="text-sm text-muted">{t("chooseNote")}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-4 rounded-lg bg-surface p-6 shadow-md sm:flex-row sm:items-center sm:p-8">
                <span
                  aria-hidden="true"
                  className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
                >
                  <Phone className="size-7" strokeWidth={1.75} />
                </span>
                <div>
                  <h3 className="text-xl font-bold">{t("pricesEmptyTitle")}</h3>
                  <p className="text-muted">{t("pricesEmptyBody")}</p>
                  {hasContact && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {phone && (
                        <a href={`tel:${dialable(phone)}`} className={quiet}>
                          <Phone aria-hidden="true" className="size-5" />
                          {t("call")}
                        </a>
                      )}
                      {whatsapp && (
                        <a href={whatsappUrl(whatsapp)} className={quiet}>
                          <MessageCircle
                            aria-hidden="true"
                            className="size-5"
                          />
                          {t("whatsapp")}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {rules.length > 0 && (
          <section className="pt-16 md:pt-24" aria-labelledby="policy-title">
            <details className="group rounded-lg bg-surface shadow-md">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-6">
                <h2 id="policy-title" className="text-xl font-bold md:text-2xl">
                  {t("policy")}
                </h2>
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                  strokeWidth={1.75}
                />
              </summary>
              <ol className="grid list-none gap-3 px-6 pb-6">
                {rules.map((rule, index) => (
                  <li
                    key={`${index}-${rule}`}
                    className="grid grid-cols-8 items-start gap-3 text-muted"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex size-8 items-center justify-center rounded-full bg-fill text-sm font-semibold text-fg"
                    >
                      {index + 1}
                    </span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
            </details>
          </section>
        )}

        {hasContact && (
          <section
            className="mt-16 flex flex-wrap items-center gap-3 rounded-lg bg-brand p-6 text-brand-fg md:mt-24 md:p-8"
            aria-labelledby="contact-title"
          >
            <div className="me-auto">
              <h2 id="contact-title" className="text-2xl font-bold md:text-3xl">
                {t("contact")}
              </h2>
              {phone && (
                <p className="text-lg font-medium">
                  <bdi dir="ltr">{phone}</bdi>
                </p>
              )}
            </div>
            {phone && (
              <a
                href={`tel:${dialable(phone)}`}
                className="hidden min-h-(--size-touch) items-center gap-2 rounded-full bg-brand-fg px-6 font-semibold text-brand sm:inline-flex"
              >
                <Phone aria-hidden="true" className="size-5" />
                {t("call")}
              </a>
            )}
            {whatsapp && (
              <a
                href={whatsappUrl(whatsapp)}
                className="hidden min-h-(--size-touch) items-center gap-2 rounded-full bg-brand-fg px-6 font-semibold text-brand sm:inline-flex"
              >
                <MessageCircle aria-hidden="true" className="size-5" />
                {t("whatsapp")}
              </a>
            )}
          </section>
        )}
      </main>

      <footer className="mx-auto flex max-w-content flex-wrap justify-between gap-3 px-4 pb-24 pt-8 text-sm text-muted md:px-6 md:pb-12">
        <Link
          href="/find-booking"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          {t("findBookingFooter")}
        </Link>
        <span>{t("venueName")}</span>
      </footer>

      {hasContact && (
        <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2 bg-surface p-2 shadow-lg sm:hidden">
          {phone && (
            <a href={`tel:${dialable(phone)}`} className={`${primary} flex-1`}>
              <Phone aria-hidden="true" className="size-5" />
              {t("call")}
            </a>
          )}
          {whatsapp && (
            <a href={whatsappUrl(whatsapp)} className={`${quiet} flex-1`}>
              <MessageCircle aria-hidden="true" className="size-5" />
              {t("whatsapp")}
            </a>
          )}
        </div>
      )}
    </>
  );
}
