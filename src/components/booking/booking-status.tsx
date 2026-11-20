"use client";

import {
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  Hourglass,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { ContactButtons } from "@/components/calendar/contact-fallback";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  fetchBookingByToken,
  remainingFromServer,
  type PublicBooking,
  type PublicBookingStatus,
} from "@/lib/booking-read-api";
import { longDayLabel } from "@/lib/calendar-grid";
import { formatTime } from "@/lib/slot-time";

import { CopyButton } from "./copy-button";
import { clockLabel, countdownWarning, shouldAnnounce } from "./countdown";

// The customer's page for one booking (docs/design/views/booking-status.md).
// The server rendered the first status; this half polls for a change every 30
// seconds while the tab is visible and on regaining focus, keeps the last known
// status when a refresh fails, and runs the countdown from the server's deadline
// rather than the visitor's clock.

const POLL_INTERVAL_MS = 30_000;

const STATUS_STYLE: Record<
  PublicBookingStatus,
  { className: string; Icon: LucideIcon }
> = {
  held: { className: "bg-warning-soft text-warning", Icon: Hourglass },
  proof_submitted: { className: "bg-brand-soft text-brand", Icon: Eye },
  confirmed: { className: "bg-accent-soft text-accent", Icon: CheckCircle2 },
  expired: { className: "bg-fill text-muted", Icon: Clock },
  rejected: { className: "bg-danger-soft text-danger", Icon: XCircle },
  cancelled: { className: "bg-fill text-muted", Icon: Ban },
};

const TERMINAL: ReadonlySet<PublicBookingStatus> = new Set([
  "expired",
  "rejected",
  "cancelled",
]);

export function BookingStatus({
  token,
  initial,
}: {
  token: string;
  initial: PublicBooking;
}) {
  const t = useTranslations("BookingPage");
  const titles = useTranslations("BookingPage.statusTitle");
  const hints = useTranslations("BookingPage.hint");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });

  const [booking, setBooking] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Seconds left, re-anchored on every server answer. The initial value comes
  // from the server payload, so the first paint is the same on both sides.
  const [remaining, setRemaining] = useState(() =>
    remainingFromServer(initial.deadlineAt, initial.refreshedAt),
  );

  // A held booking whose clock reaches zero is expired here at once, without
  // waiting for the next poll or the sweep (ADR-010).
  const status: PublicBookingStatus =
    booking.status === "held" && remaining <= 0 ? "expired" : booking.status;
  const held = status === "held";

  // The countdown is a timer region announced at sensible intervals, not every
  // second; a status change is announced assertively exactly once.
  const [countdownNotice, setCountdownNotice] = useState("");
  const [statusNotice, setStatusNotice] = useState("");
  const previousRemaining = useRef<number | null>(null);
  const previousStatus = useRef(status);

  const refresh = useCallback(async () => {
    const result = await fetchBookingByToken(token);
    if (result.ok && result.data) {
      const next = result.data;
      setBooking(next);
      // Each fresh answer carries both the deadline and the server's own now, so
      // the remaining time never trusts the visitor's clock and drift is
      // corrected on every poll.
      setRemaining(remainingFromServer(next.deadlineAt, next.refreshedAt));
      setOffline(false);
    } else {
      setOffline(true);
    }
  }, [token]);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") void refreshRef.current();
    };
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    window.addEventListener("focus", poll);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", poll);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);

  // Each fresh answer carries both the deadline and the server's own now, so the
  // remaining time never trusts the visitor's clock and drift is corrected.
  const ticking = booking.deadlineAt !== null && remaining > 0;
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  useEffect(() => {
    const before = previousRemaining.current;
    previousRemaining.current = remaining;
    if (!shouldAnnounce(remaining, before)) return;
    setCountdownNotice(t("timeLeft", { time: clockLabel(remaining) }));
  }, [remaining, t]);

  useEffect(() => {
    if (previousStatus.current === status) return;
    previousStatus.current = status;
    setStatusNotice(t("statusChanged", { status: titles(status) }));
  }, [status, t, titles]);

  const style = STATUS_STYLE[status];
  const warning = countdownWarning(remaining, held);
  const warningText =
    warning === "under-one"
      ? t("lessThanOne")
      : warning === "under-five"
        ? t("lessThanFive")
        : "";
  const occasion =
    locale === "ar" ? booking.occasion.nameAr : booking.occasion.nameEn;
  const transfer = held ? booking.transfer : null;
  const offersCopy = Boolean(
    transfer?.vodafoneCashNumber || transfer?.instapayAddress,
  );

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="sr-only">
        {countdownNotice}
      </p>
      <p aria-live="assertive" className="sr-only">
        {statusNotice}
      </p>

      {offline && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          <span>{t("notLive")}</span>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={retrying}
            onClick={() => {
              setRetrying(true);
              void refreshRef.current().finally(() => setRetrying(false));
            }}
          >
            {t("retry")}
          </Button>
        </div>
      )}

      <section
        aria-labelledby="booking-status-heading"
        className="space-y-5 rounded-lg bg-surface p-6 shadow-md"
      >
        <div className="space-y-2">
          <span
            aria-hidden="true"
            className={`inline-flex size-12 items-center justify-center rounded-full ${style.className}`}
          >
            <style.Icon className="size-6" strokeWidth={1.75} />
          </span>
          <h2 id="booking-status-heading" className="text-2xl font-bold">
            {titles(status)}
          </h2>
          <p className="text-muted">{hints(status)}</p>
        </div>

        {held && (
          <div className="space-y-1">
            <p className="text-sm text-muted">{t("countdownLabel")}</p>
            <p
              role="timer"
              className={`font-mono text-4xl font-bold tabular-nums ${
                warning === "under-one"
                  ? "text-danger"
                  : warning === "under-five"
                    ? "text-warning"
                    : "text-fg"
              }`}
            >
              <bdi>{clockLabel(remaining)}</bdi>
            </p>
            {warningText && (
              <p
                className={`text-sm font-medium ${
                  warning === "under-one" ? "text-danger" : "text-warning"
                }`}
              >
                {warningText}
              </p>
            )}
          </div>
        )}

        {held && (
          <div className="space-y-3 rounded-lg bg-fill p-4">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-sm">{t("deposit")}</span>
              <span className="text-lg font-semibold tabular-nums">
                {money.format(booking.depositEgp)}
              </span>
            </p>
            {offersCopy && transfer ? (
              <dl className="space-y-2">
                {transfer.vodafoneCashNumber && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-sm text-muted">{t("vodafoneCash")}</dt>
                    <dd className="flex items-center gap-1">
                      <bdi dir="ltr" className="font-mono">
                        {transfer.vodafoneCashNumber}
                      </bdi>
                      <CopyButton
                        value={transfer.vodafoneCashNumber}
                        label={t("vodafoneCash")}
                      />
                    </dd>
                  </div>
                )}
                {transfer.instapayAddress && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-sm text-muted">{t("instapay")}</dt>
                    <dd className="flex items-center gap-1">
                      <bdi dir="ltr" className="font-mono">
                        {transfer.instapayAddress}
                      </bdi>
                      <CopyButton
                        value={transfer.instapayAddress}
                        label={t("instapay")}
                      />
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted">{t("paymentUnavailable")}</p>
            )}
          </div>
        )}

        {held && <p className="text-sm text-muted">{t("sharePrivate")}</p>}
      </section>

      <section
        aria-labelledby="booking-summary-heading"
        className={
          status === "confirmed"
            ? "space-y-4 rounded-lg border-2 border-brand bg-surface p-6 shadow-md"
            : "space-y-4 rounded-lg bg-surface p-6 shadow-md"
        }
      >
        <h2 id="booking-summary-heading" className="text-lg font-bold">
          {status === "confirmed" ? t("confirmedTitle") : t("summary")}
        </h2>

        <dl className="space-y-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted">{t("bookingId")}</dt>
            <dd className="flex items-center gap-1">
              <bdi dir="ltr" className="font-mono font-semibold">
                {booking.bookingId}
              </bdi>
              <CopyButton value={booking.bookingId} label={t("bookingId")} />
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted">{t("occasion")}</dt>
            <dd>{occasion}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted">{t("date")}</dt>
            <dd>{longDayLabel(booking.day, locale)}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted">{t("time")}</dt>
            <dd className="font-mono tabular-nums">
              <bdi>{formatTime(booking.start, locale)}</bdi>
              <span aria-hidden="true"> – </span>
              <bdi>{formatTime(booking.end, locale)}</bdi>
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted">{t("name")}</dt>
            <dd>{booking.customerName}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2">
            <dt className="text-muted">{t("price")}</dt>
            <dd className="font-mono tabular-nums">
              {money.format(booking.priceEgp)}
            </dd>
          </div>
          {status === "confirmed" && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted">{t("remainder")}</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {money.format(booking.remainderEgp)}
              </dd>
            </div>
          )}
        </dl>

        {status === "confirmed" && booking.remainderPaid && (
          <p className="text-sm text-accent">{t("remainderPaid")}</p>
        )}
      </section>

      {TERMINAL.has(status) && (
        <Button
          asChild
          className="h-(--size-touch) w-full rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
        >
          <Link href="/calendar">{t("bookAgain")}</Link>
        </Button>
      )}

      <section className="space-y-3 rounded-lg bg-surface p-6 shadow-md">
        <h2 className="text-lg font-bold">{t("contactTitle")}</h2>
        <ContactButtons />
      </section>
    </div>
  );
}
