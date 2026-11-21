"use client";

import { CalendarX, MessageCircle, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { RefObject } from "react";

import { Link } from "@/i18n/navigation";
import type { AvailabilityDay, AvailabilitySlot } from "@/lib/calendar-api";
import { longDayLabel } from "@/lib/calendar-grid";
import { formatTime } from "@/lib/slot-time";
import {
  dialable,
  venueContact,
  whatsappUrl,
  type VenueContact,
} from "@/lib/venue-contact";

import { ContactButtons } from "./contact-fallback";
import { StateBadge } from "./state-badge";

// The selected day (docs/design/views/calendar.md): its slots as pill-shaped
// rows with a time range, a state badge and, only where an action exists, a
// Book link or the phone and WhatsApp buttons for a near slot. Taken slots are
// plain list items, not disabled buttons, so nothing announces an action that
// is not there.

export interface DayPanelProps {
  /** `YYYY-MM-DD`, Africa/Cairo. */
  day: string;
  data: AvailabilityDay | undefined;
  today: string;
  /** `${day}|${start}` for slots whose state just changed; their badge pops once. */
  changed?: ReadonlySet<string>;
  contact?: VenueContact;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  /** An occasion chosen on the landing page, carried into every booking link. */
  occasionId?: number;
}

export function DayPanel({
  day,
  data,
  today,
  changed,
  contact = venueContact,
  headingRef,
  occasionId,
}: DayPanelProps) {
  const t = useTranslations("Calendar");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const slots = data?.slots ?? [];
  const free = slots.filter((slot) => slot.state === "free").length;
  const isToday = day === today;

  return (
    <section
      className="rounded-lg bg-surface p-4 shadow-md sm:p-6"
      aria-labelledby="calendar-day-heading"
    >
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2
          id="calendar-day-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold"
        >
          {longDayLabel(day, locale)}
          <small className="block text-sm font-normal text-muted">
            {isToday && `${t("today")} · `}
            {t("slotsFree", { count: free })}
          </small>
        </h2>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-muted">
          <RefreshMark />
          {t("refreshedJustNow")}
        </span>
      </div>

      {slots.length === 0 ? (
        <div className="flex flex-col items-center px-2 py-8 text-center sm:py-10">
          <span
            aria-hidden="true"
            className="inline-flex size-16 items-center justify-center rounded-full bg-fill text-muted"
          >
            <CalendarX className="size-7" strokeWidth={1.75} />
          </span>
          <h3 className="mt-4 text-xl font-bold">{t("noSlotsTitle")}</h3>
          <p className="mt-1 max-w-[36ch] text-muted">{t("noSlotsBody")}</p>
          <div className="mt-5">
            <ContactButtons contact={contact} />
          </div>
        </div>
      ) : (
        <ul className="grid gap-2">
          {slots.map((slot) => (
            <SlotRow
              key={`${slot.start}-${slot.end}`}
              day={day}
              slot={slot}
              locale={locale}
              contact={contact}
              occasionId={occasionId}
              changed={changed?.has(`${day}|${slot.start}`) ?? false}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RefreshMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function SlotRow({
  day,
  slot,
  locale,
  contact,
  changed,
  occasionId,
}: {
  day: string;
  slot: AvailabilitySlot;
  locale: string;
  contact: VenueContact;
  changed: boolean;
  occasionId?: number;
}) {
  const t = useTranslations("Calendar");
  const start = formatTime(slot.start, locale);
  const end = formatTime(slot.end, locale);
  const open = slot.state === "free" && slot.action !== "none";
  const bookable = slot.action === "book";
  const query = new URLSearchParams({
    day,
    start: slot.start,
    end: slot.end,
  });
  if (occasionId !== undefined) query.set("occasion", String(occasionId));
  const bookHref = `/book?${query}`;

  return (
    <li
      className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-lg px-4 py-3 sm:min-h-[68px] sm:grid-cols-[1fr_auto_auto] sm:gap-4 sm:rounded-full sm:py-2 sm:pe-2 sm:ps-6 ${
        open ? "bg-accent-soft" : "bg-bg"
      }`}
    >
      <span
        className={`text-lg text-muted ${
          open ? "font-semibold text-fg" : "font-medium"
        }`}
      >
        <bdi className="tabular-nums">{start}</bdi>
        <span aria-hidden="true"> – </span>
        <bdi className="tabular-nums">{end}</bdi>
      </span>

      {slot.action === "call" ? (
        <span className="justify-self-end rounded-full bg-surface px-3 py-1 text-sm font-medium whitespace-nowrap">
          <Phone
            aria-hidden="true"
            className="me-2 inline size-4"
            strokeWidth={1.75}
          />
          {t("callToBook")}
        </span>
      ) : (
        <StateBadge
          state={slot.state}
          changed={changed}
          className={
            open ? "justify-self-end sm:justify-self-start" : "justify-self-end"
          }
        />
      )}

      {bookable && (
        <span className="col-span-2 sm:col-span-1">
          <Link
            href={bookHref}
            aria-label={t("bookSlot", { from: start, to: end })}
            className="inline-flex min-h-(--size-touch) w-full items-center justify-center rounded-full bg-brand px-6 font-semibold text-brand-fg transition-colors hover:bg-brand-hover motion-reduce:transition-none"
          >
            {t("book")}
          </Link>
        </span>
      )}

      {slot.action === "call" && (
        <span className="col-span-2 flex gap-2 sm:col-span-1">
          {contact.phone && (
            <a
              href={`tel:${dialable(contact.phone)}`}
              aria-label={t("callSlot", { time: start })}
              className="inline-flex size-(--size-touch) flex-1 items-center justify-center rounded-full bg-surface text-fg transition-colors hover:bg-fill motion-reduce:transition-none sm:flex-none"
            >
              <Phone aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </a>
          )}
          {contact.whatsapp && (
            <a
              href={whatsappUrl(contact.whatsapp)}
              aria-label={t("whatsappSlot", { time: start })}
              className="inline-flex size-(--size-touch) flex-1 items-center justify-center rounded-full bg-surface text-fg transition-colors hover:bg-fill motion-reduce:transition-none sm:flex-none"
            >
              <MessageCircle
                aria-hidden="true"
                className="size-5"
                strokeWidth={1.75}
              />
            </a>
          )}
        </span>
      )}
    </li>
  );
}
