"use client";

import { MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  dialable,
  venueContact,
  whatsappUrl,
  type VenueContact,
} from "@/lib/venue-contact";

// The venue's phone and WhatsApp (docs/design/views/calendar.md). Shown under
// the cards, in the empty and error moments, and beside a near slot. The
// numbers can be unset, in which case nothing that would lead nowhere renders.

const link =
  "inline-flex min-h-(--size-touch) items-center justify-center gap-2 rounded-full bg-fill px-6 font-semibold text-fg transition-colors hover:bg-border motion-reduce:transition-none";

/** One quiet line at the end of the page. */
export function ContactLine({
  contact = venueContact,
}: {
  contact?: VenueContact;
}) {
  const t = useTranslations("Calendar");
  const { phone, whatsapp } = contact;
  if (!phone && !whatsapp) return null;

  return (
    <p className="text-sm text-muted">
      {t("help")}{" "}
      {phone && (
        <a
          href={`tel:${dialable(phone)}`}
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          {t("call")}
        </a>
      )}
      {phone && whatsapp && ` ${t("or")} `}
      {whatsapp && (
        <a
          href={whatsappUrl(whatsapp)}
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          {t("whatsapp")}
        </a>
      )}
      .
    </p>
  );
}

/** The two full-width buttons of the empty and error moments. */
export function ContactButtons({
  contact = venueContact,
}: {
  contact?: VenueContact;
}) {
  const t = useTranslations("Calendar");
  const { phone, whatsapp } = contact;
  if (!phone && !whatsapp) return null;

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {phone && (
        <a href={`tel:${dialable(phone)}`} className={link}>
          <Phone aria-hidden="true" className="size-5" strokeWidth={1.75} />
          {t("call")}
        </a>
      )}
      {whatsapp && (
        <a href={whatsappUrl(whatsapp)} className={link}>
          <MessageCircle
            aria-hidden="true"
            className="size-5"
            strokeWidth={1.75}
          />
          {t("whatsapp")}
        </a>
      )}
    </div>
  );
}
