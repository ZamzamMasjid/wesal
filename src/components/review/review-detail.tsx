"use client";

import { AlertTriangle, ChevronLeft, ImageOff, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link, useRouter } from "@/i18n/navigation";
import { longDayLabel } from "@/lib/calendar-grid";
import {
  confirmBooking,
  fetchReviewDetail,
  fetchReviewQueue,
  markProofReceived,
  proofFileHref,
  rejectBooking,
  reviewHref,
  REJECT_REASONS,
  type RejectReason,
  type ReviewDetail,
} from "@/lib/review-api";
import { formatTime } from "@/lib/slot-time";

function money(locale: "ar" | "en", amount: number): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** One payment's review page: deposit first, screenshot, then one decision. */
export function ReviewDetailView({ initial }: { initial: ReviewDetail }) {
  const t = useTranslations("Dashboard.review");
  const statusTitles = useTranslations("Dashboard.review.status");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const router = useRouter();

  const [detail, setDetail] = useState(initial);
  const [busy, setBusy] = useState<"confirm" | "reject" | "received" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState<RejectReason>("wrong_amount");
  const [note, setNote] = useState("");
  const [confirmNow, setConfirmNow] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [failedProofId, setFailedProofId] = useState<number | null>(null);

  const latestProof = detail.proofs[0] ?? null;
  const imageFailed = latestProof !== null && failedProofId === latestProof.id;
  const screenshotAvailable =
    latestProof !== null &&
    latestProof.receivedVia === "upload" &&
    latestProof.purgedAt === null &&
    !imageFailed;

  /** Opens the next booking waiting, or the empty queue. */
  const advance = useCallback(async () => {
    const result = await fetchReviewQueue();
    if (result.ok && result.data) {
      const next = result.data.items.find(
        (item) => item.bookingId !== detail.bookingId,
      );
      if (next) {
        router.replace(reviewHref(next.bookingId));
        router.refresh();
        return;
      }
    }
    router.replace("/dashboard/review");
    router.refresh();
  }, [detail.bookingId, router]);

  function problemText(
    code: string | undefined,
    details: Record<string, unknown> | undefined,
  ): string {
    if (code === "BOOKING_STATUS_CHANGED") {
      const status = typeof details?.status === "string" ? details.status : "";
      return t("errorStatusChanged", {
        status: status
          ? statusTitles(status as ReviewDetail["status"])
          : statusTitles(detail.status),
      });
    }
    if (code === "NOT_FOUND") return t("errorNotFound");
    return t("errorFailed");
  }

  async function finish(result: Awaited<ReturnType<typeof confirmBooking>>) {
    if (result.ok) {
      setError(null);
      await advance();
      return;
    }
    setError(problemText(result.error?.code, result.error?.details));
  }

  async function onConfirm() {
    if (busy) return;
    setBusy("confirm");
    setConfirmOpen(false);
    const result = await confirmBooking(detail.bookingId);
    setBusy(null);
    await finish(result);
  }

  async function onReject() {
    if (busy) return;
    setBusy("reject");
    setRejectOpen(false);
    const result = await rejectBooking(
      detail.bookingId,
      reason,
      note.trim() ? note : undefined,
    );
    setBusy(null);
    await finish(result);
  }

  async function onProofReceived() {
    if (busy) return;
    setBusy("received");
    const result: Awaited<ReturnType<typeof markProofReceived>> =
      await markProofReceived(detail.bookingId, confirmNow);
    setBusy(null);
    if (!result.ok) {
      setError(problemText(result.error?.code, result.error?.details));
      return;
    }
    setError(null);
    if (result.data?.status === "proof_submitted") {
      // Stay on the page: the booking is now waiting and can be confirmed in
      // the same visit.
      const refreshed = await fetchReviewDetail(detail.bookingId);
      if (refreshed.ok && refreshed.data) setDetail(refreshed.data);
      return;
    }
    await advance();
  }

  const occasion =
    locale === "ar" ? detail.occasion.nameAr : detail.occasion.nameEn;
  const proofMessage = latestProof
    ? latestProof.receivedVia === "whatsapp"
      ? t("proofViaWhatsapp")
      : t("screenshotMissing")
    : t("noProof");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/dashboard/review"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ChevronLeft className="size-5 [dir=rtl]:rotate-180" aria-hidden />
          {t("back")}
        </Link>
        <bdi dir="ltr" className="font-mono font-semibold">
          {detail.bookingId}
        </bdi>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <section
        aria-labelledby="review-deposit-heading"
        className="rounded-lg bg-surface p-5 shadow-md"
      >
        <h2 id="review-deposit-heading" className="text-sm text-muted">
          {t("depositExpected")}
        </h2>
        <p className="font-mono text-4xl font-bold tabular-nums">
          <bdi>{money(locale, detail.depositEgp)}</bdi>
        </p>
        <p className="mt-1 text-sm">
          {occasion}
          <span aria-hidden="true"> · </span>
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
        {detail.urgent && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
            <AlertTriangle className="size-4" aria-hidden />
            {t("urgent")}
          </span>
        )}
      </section>

      <section
        aria-labelledby="review-screenshot-heading"
        className="space-y-2"
      >
        <h2 id="review-screenshot-heading" className="text-lg font-bold">
          {t("screenshot")}
        </h2>
        {screenshotAvailable && latestProof ? (
          <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="block w-full overflow-hidden rounded-lg bg-fill focus-visible:ring-2 focus-visible:ring-focus"
                aria-label={t("screenshotOpen")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proofFileHref(latestProof.id)}
                  alt={t("screenshotAlt", { bookingId: detail.bookingId })}
                  className="max-h-[60dvh] w-full object-contain"
                  onError={() => setFailedProofId(latestProof.id)}
                />
              </button>
            </DialogTrigger>
            <DialogContent
              className="w-[min(96vw,64rem)]"
              closeLabel={t("screenshotClose")}
            >
              <DialogTitle className="sr-only">{t("screenshot")}</DialogTitle>
              <DialogDescription className="sr-only">
                {t("screenshotAlt", { bookingId: detail.bookingId })}
              </DialogDescription>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proofFileHref(latestProof.id)}
                alt={t("screenshotAlt", { bookingId: detail.bookingId })}
                className="mx-auto max-h-[78dvh] w-auto object-contain"
              />
              <p className="mt-2 text-center text-xs text-muted">
                {t("screenshotZoomHint")}
              </p>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="flex flex-col items-center gap-1 rounded-lg bg-fill p-8 text-center">
            <ImageOff className="size-8 text-muted" aria-hidden />
            <p className="font-medium">{proofMessage}</p>
            <p className="text-sm text-muted">{t("screenshotMissingHint")}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="review-details-heading">
        <h2 id="review-details-heading" className="mb-2 text-lg font-bold">
          {t("customer")}
        </h2>
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
            <dt className="text-muted">{t("remainder")}</dt>
            <dd className="font-mono tabular-nums">
              {money(locale, detail.remainderEgp)}
            </dd>
          </div>
        </dl>
      </section>

      {detail.status === "proof_submitted" && (
        <div className="sticky bottom-20 z-20 flex flex-wrap gap-3 rounded-lg bg-surface p-3 shadow-lg md:static md:bg-transparent md:p-0 md:shadow-none">
          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-(--size-touch) flex-1 rounded-full border-danger text-danger hover:bg-danger-soft"
                disabled={busy !== null}
              >
                {t("reject")}
              </Button>
            </DialogTrigger>
            <DialogContent closeLabel={t("cancel")}>
              <DialogTitle>{t("rejectTitle")}</DialogTitle>
              <DialogDescription>{t("rejectBody")}</DialogDescription>
              <fieldset className="mt-4 space-y-2">
                <legend className="mb-2 text-sm font-medium">
                  {t("reason")}
                </legend>
                {REJECT_REASONS.map((value) => (
                  <label
                    key={value}
                    className="flex min-h-(--size-touch-dense) items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="reject-reason"
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="size-4 accent-danger"
                    />
                    {t(
                      value === "wrong_amount"
                        ? "reasonWrongAmount"
                        : value === "unreadable_image"
                          ? "reasonUnreadable"
                          : value === "no_transfer"
                            ? "reasonNoTransfer"
                            : "reasonOther",
                    )}
                  </label>
                ))}
              </fieldset>
              <label className="mt-3 block space-y-1 text-sm">
                {t("note")}
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-md border border-border bg-surface p-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </label>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                  >
                    {t("cancel")}
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={() => void onReject()}
                  className="rounded-full bg-danger text-brand-fg hover:bg-danger"
                >
                  {t("rejectAction")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className="h-(--size-touch) flex-1 rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
                disabled={busy !== null}
              >
                {busy === "confirm" ? t("confirming") : t("confirm")}
              </Button>
            </DialogTrigger>
            <DialogContent closeLabel={t("cancel")}>
              <DialogTitle>{t("confirmTitle")}</DialogTitle>
              <DialogDescription>{t("confirmBody")}</DialogDescription>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                  >
                    {t("cancel")}
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={() => void onConfirm()}
                  className="rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
                >
                  {t("confirmAction")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {detail.status === "held" && (
        <section className="space-y-3 rounded-lg bg-surface p-4 shadow-md">
          <h2 className="text-lg font-bold">{t("proofReceived")}</h2>
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

      {detail.status !== "held" && detail.status !== "proof_submitted" && (
        <section className="space-y-3 rounded-lg bg-fill p-4">
          <p className="font-medium">
            {t("alreadyDecided", {
              status: statusTitles(detail.status),
            })}
          </p>
          <p className="text-sm text-muted">{t("alreadyDecidedHint")}</p>
          <Button asChild className="h-(--size-touch) rounded-full">
            <Link href="/dashboard/review">{t("next")}</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
