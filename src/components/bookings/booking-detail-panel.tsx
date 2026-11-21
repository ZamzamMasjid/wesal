"use client";

import { Ban, ChevronLeft, ImageOff, Phone, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import {
  cancelBooking,
  markRemainderPaid,
  type AdminBookingDetail,
  type AdminBookingStatus,
} from "@/lib/booking-admin-api";
import { cairoParts } from "@/lib/cairo-time";
import { longDayLabel } from "@/lib/calendar-grid";
import { markProofReceived, proofFileHref, reviewHref } from "@/lib/review-api";
import { formatTime } from "@/lib/slot-time";

// One booking's detail (docs/design/views/bookings.md): summary, proofs and the
// history of customer and staff events, then the two offline actions — cancel
// and mark the remainder paid. Both confirm before acting and appear in the
// history as soon as the server answers.

function money(locale: "ar" | "en", amount: number): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface Props {
  detail: AdminBookingDetail;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  /** Called after a change committed, so the list and detail are re-read. */
  onMutated: () => void;
}

export function BookingDetailPanel({
  detail,
  headingRef,
  onClose,
  onMutated,
}: Props) {
  const t = useTranslations("Dashboard.bookings.detail");
  const viewT = useTranslations("Dashboard.bookings");
  const statusTitles = useTranslations("Dashboard.bookings.status");
  const sources = useTranslations("Dashboard.bookings.source");
  const remainder = useTranslations("Dashboard.bookings.remainder");
  const historyLabels = useTranslations("Dashboard.bookings.history");
  const locale = useLocale() === "ar" ? "ar" : "en";

  const [busy, setBusy] = useState<"cancel" | "paid" | "received" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paidOpen, setPaidOpen] = useState(false);
  const [paidError, setPaidError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);
  const [confirmNow, setConfirmNow] = useState(false);

  const occasion =
    locale === "ar" ? detail.occasion.nameAr : detail.occasion.nameEn;

  function problemText(
    code: string | undefined,
    details: Record<string, unknown> | undefined,
  ): string {
    if (code === "BOOKING_STATUS_CHANGED") {
      const status = typeof details?.status === "string" ? details.status : "";
      return t("statusChanged", {
        status: status
          ? statusTitles(status as AdminBookingStatus)
          : statusTitles(detail.status),
      });
    }
    if (code === "NOT_FOUND") return t("notFound");
    return t("failed");
  }

  async function onMarkPaid() {
    if (busy) return;
    setBusy("paid");
    setPaidError(null);
    setNotice(null);
    const result = await markRemainderPaid(detail.bookingId);
    setBusy(null);
    if (!result.ok) {
      // The dialog stays open so the failure is where the staff member is
      // looking, not behind its overlay.
      setPaidError(problemText(result.error?.code, result.error?.details));
      return;
    }
    setPaidOpen(false);
    setNotice(t("markedPaid"));
    onMutated();
  }

  async function onCancel() {
    if (busy) return;
    if (!reason.trim()) {
      setReasonMissing(true);
      return;
    }
    setBusy("cancel");
    setCancelError(null);
    setNotice(null);
    const result = await cancelBooking(detail.bookingId, reason.trim());
    setBusy(null);
    if (!result.ok) {
      setCancelError(problemText(result.error?.code, result.error?.details));
      return;
    }
    setCancelOpen(false);
    setReason("");
    setNotice(t("cancelled"));
    onMutated();
  }

  async function onProofReceived() {
    if (busy) return;
    setBusy("received");
    setError(null);
    setNotice(null);
    const result = await markProofReceived(detail.bookingId, confirmNow);
    setBusy(null);
    if (!result.ok) {
      setError(problemText(result.error?.code, result.error?.details));
      return;
    }
    setConfirmNow(false);
    setNotice(t("proofReceivedDone"));
    onMutated();
  }

  const cancellable = detail.status === "confirmed";

  return (
    <section aria-labelledby="booking-detail-heading" className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <bdi dir="ltr" className="font-mono text-sm font-semibold">
            {detail.bookingId}
          </bdi>
          <h2
            id="booking-detail-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-bold focus:outline-none"
          >
            {occasion}
          </h2>
          <p className="text-sm text-muted">
            {longDayLabel(detail.day, locale)}
            <span aria-hidden="true"> · </span>
            <bdi className="font-mono tabular-nums">
              {formatTime(detail.start, locale)}
            </bdi>
            <span aria-hidden="true"> – </span>
            <bdi className="font-mono tabular-nums">
              {formatTime(detail.end, locale)}
            </bdi>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={viewT("close")}
          className="size-(--size-touch-dense) rounded-full"
        >
          <X className="size-5" aria-hidden />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <BookingStatusBadge status={detail.status} />
        <span className="rounded-full bg-fill px-2.5 py-0.5 text-xs font-medium">
          {sources(detail.source)}
        </span>
        {detail.status === "held" || detail.status === "proof_submitted" ? (
          <Link
            href={reviewHref(detail.bookingId)}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronLeft className="size-4 [dir=rtl]:rotate-180" aria-hidden />
            {t("openReview")}
          </Link>
        ) : null}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-success-soft p-3 text-sm text-success"
        >
          {notice}
        </p>
      )}

      <dl className="space-y-2 rounded-lg bg-surface p-4 text-sm shadow-md">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted">{t("customer")}</dt>
          <dd>{detail.customerName}</dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted">{t("phone")}</dt>
          <dd className="flex items-center gap-2">
            <bdi dir="ltr" className="font-mono">
              {detail.customerPhone}
            </bdi>
            <a
              href={`tel:${detail.customerPhone}`}
              className="inline-flex items-center gap-1 text-brand hover:underline focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Phone className="size-4" aria-hidden />
              {t("call")}
            </a>
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted">{t("price")}</dt>
          <dd className="font-mono tabular-nums">
            {money(locale, detail.priceEgp)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted">{t("deposit")}</dt>
          <dd className="font-mono tabular-nums">
            {money(locale, detail.depositEgp)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted">{t("remainder")}</dt>
          <dd className="flex items-center gap-2 font-mono tabular-nums">
            {money(locale, detail.remainderEgp)}
            <span
              className={`rounded-full px-2 py-0.5 font-sans text-xs font-medium ${
                detail.remainderPaid
                  ? "bg-success-soft text-success"
                  : "bg-warning-soft text-warning"
              }`}
            >
              {detail.remainderPaid ? remainder("paid") : remainder("unpaid")}
            </span>
          </dd>
        </div>
      </dl>

      <section aria-labelledby="booking-proofs-heading" className="space-y-2">
        <h3 id="booking-proofs-heading" className="text-sm font-semibold">
          {t("proofs")}
        </h3>
        {detail.proofs.length === 0 ? (
          <p className="rounded-lg bg-fill p-3 text-sm text-muted">
            {t("noProofs")}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {detail.proofs.map((proof) => {
              const available =
                proof.receivedVia === "upload" && proof.purgedAt === null;
              return (
                <li
                  key={proof.id}
                  className="overflow-hidden rounded-lg bg-fill"
                >
                  {available ? (
                    <a
                      href={proofFileHref(proof.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="block focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proofFileHref(proof.id)}
                        alt={t("proofAlt", { bookingId: detail.bookingId })}
                        className="size-24 object-cover"
                      />
                    </a>
                  ) : (
                    <p className="flex size-24 flex-col items-center justify-center gap-1 p-1 text-center text-xs text-muted">
                      <ImageOff className="size-4" aria-hidden />
                      {proof.receivedVia === "whatsapp"
                        ? t("proofViaWhatsapp")
                        : t("proofPurged")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="booking-history-heading" className="space-y-2">
        <h3 id="booking-history-heading" className="text-sm font-semibold">
          {t("history")}
        </h3>
        {detail.history.length === 0 ? (
          <p className="text-sm text-muted">{t("historyEmpty")}</p>
        ) : (
          <ol className="space-y-2 rounded-lg bg-surface p-4 text-sm shadow-md">
            {detail.history.map((entry, index) => (
              <li
                key={`${entry.at}-${entry.action}-${index}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
              >
                <bdi className="font-mono text-xs text-muted tabular-nums">
                  {formatTime(cairoParts(new Date(entry.at)).time, locale)}
                </bdi>
                <span>{historyLabels(entry.action)}</span>
                <span className="text-muted">
                  {entry.actor === "staff" && entry.actorName
                    ? t("by", { name: entry.actorName })
                    : t("customerActor")}
                </span>
                {entry.note && (
                  <span className="basis-full text-xs text-muted">
                    {entry.note}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {detail.status === "held" && (
        <section className="space-y-3 rounded-lg bg-surface p-4 shadow-md">
          <h3 className="text-sm font-semibold">{t("proofReceived")}</h3>
          <p className="text-sm text-muted">{t("proofReceivedHint")}</p>
          <label className="flex min-h-(--size-touch-dense) items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmNow}
              onChange={(event) => setConfirmNow(event.target.checked)}
              className="size-4 accent-brand"
            />
            {t("proofReceivedAlsoConfirm")}
          </label>
          <Button
            type="button"
            onClick={() => void onProofReceived()}
            disabled={busy !== null}
            className="h-(--size-touch) w-full rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
          >
            {busy === "received"
              ? t("proofReceiving")
              : t("proofReceivedAction")}
          </Button>
        </section>
      )}

      {cancellable ? (
        <div className="flex flex-wrap gap-2">
          <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null || detail.remainderPaid}
                className="h-(--size-touch) flex-1 rounded-full"
              >
                {detail.remainderPaid
                  ? t("alreadyPaid")
                  : busy === "paid"
                    ? t("markingPaid")
                    : t("markPaid")}
              </Button>
            </DialogTrigger>
            <DialogContent closeLabel={t("closeDialog")}>
              <DialogTitle>{t("markPaidTitle")}</DialogTitle>
              <DialogDescription>{t("markPaidBody")}</DialogDescription>
              {paidError && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger"
                >
                  {paidError}
                </p>
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={busy !== null}
                  >
                    {t("dismiss")}
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={() => void onMarkPaid()}
                  disabled={busy !== null}
                  className="rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
                >
                  {t("markPaidConfirm")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={cancelOpen}
            onOpenChange={(next) => {
              setCancelOpen(next);
              setCancelError(null);
              setReasonMissing(false);
            }}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                className="h-(--size-touch) flex-1 rounded-full border-danger text-danger hover:bg-danger-soft"
              >
                <Ban className="size-4" aria-hidden />
                {t("cancel")}
              </Button>
            </DialogTrigger>
            <DialogContent closeLabel={t("closeDialog")}>
              <DialogTitle>{t("cancelTitle")}</DialogTitle>
              <DialogDescription>{t("cancelBody")}</DialogDescription>
              <label className="mt-4 block space-y-1 text-sm">
                {t("cancelReason")}
                <textarea
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonMissing(false);
                  }}
                  maxLength={500}
                  rows={3}
                  aria-invalid={reasonMissing || undefined}
                  aria-describedby="cancel-reason-hint"
                  className={`w-full rounded-lg border bg-surface p-3 outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    reasonMissing ? "border-danger" : "border-border"
                  }`}
                />
              </label>
              <p id="cancel-reason-hint" className="mt-1 text-xs text-muted">
                {reasonMissing ? t("cancelNeedsReason") : t("cancelReasonHint")}
              </p>
              {cancelError && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger"
                >
                  {cancelError}
                </p>
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={busy !== null}
                  >
                    {t("dismiss")}
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={() => void onCancel()}
                  disabled={busy !== null}
                  className="rounded-full bg-danger text-brand-fg hover:bg-danger"
                >
                  {busy === "cancel" ? t("cancelling") : t("cancelConfirm")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <p className="rounded-lg bg-fill p-3 text-sm text-muted">
          {t("notCancellable")}
        </p>
      )}
    </section>
  );
}
