"use client";

import { useTranslations } from "next-intl";

import { ContactButtons } from "@/components/calendar/contact-fallback";

import { FindBookingForm } from "./find-booking-form";

// The empty moment of the booking page (docs/design/views/booking-status.md):
// an unknown link gets the same answer as an expired one, never a hint that a
// different token exists. The customer can try their booking ID or reach the
// venue instead.

export function BookingNotFound() {
  const t = useTranslations("BookingPage");

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-lg bg-surface p-6 shadow-md">
        <h2 className="text-2xl font-bold">{t("notFoundTitle")}</h2>
        <p className="text-muted">{t("notFoundBody")}</p>
      </section>

      <section className="space-y-4 rounded-lg bg-surface p-6 shadow-md">
        <FindBookingForm />
      </section>

      <ContactButtons />
    </div>
  );
}
