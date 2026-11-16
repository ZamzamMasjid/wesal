"use client";

import { useTranslations } from "next-intl";

import { dialable, venueContact, whatsappUrl } from "@/lib/venue-contact";

/** Shown when a page cannot load (database down). Needs no data from the database. */
export function ServiceNotice({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations("Unavailable");
  const { phone, whatsapp } = venueContact;

  return (
    <main className="mx-auto max-w-content space-y-4 p-6" role="alert">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="text-muted">{t("description")}</p>
      {(phone || whatsapp) && (
        <ul className="space-y-2">
          {phone && (
            <li>
              <a
                className="text-brand underline"
                href={`tel:${dialable(phone)}`}
              >
                {t("call")}: <bdi dir="ltr">{phone}</bdi>
              </a>
            </li>
          )}
          {whatsapp && (
            <li>
              <a className="text-brand underline" href={whatsappUrl(whatsapp)}>
                {t("whatsapp")}: <bdi dir="ltr">{whatsapp}</bdi>
              </a>
            </li>
          )}
        </ul>
      )}
      {onRetry && (
        <button
          type="button"
          className="text-brand underline"
          onClick={onRetry}
        >
          {t("retry")}
        </button>
      )}
    </main>
  );
}
