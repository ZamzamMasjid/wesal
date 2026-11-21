"use client";

import { AlertTriangle, Inbox } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { longDayLabel } from "@/lib/calendar-grid";
import {
  fetchReviewQueue,
  orderReviewQueue,
  reviewHref,
  waitingMinutes,
  waitingUnit,
  type ReviewQueue as ReviewQueueData,
  type ReviewQueueItem,
} from "@/lib/review-api";
import { formatTime } from "@/lib/slot-time";

const POLL_INTERVAL_MS = 30_000;

function money(locale: "ar" | "en", amount: number): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** The queue of payments waiting for a person (docs/design/views/review-queue.md). */
export function ReviewQueue({ initial }: { initial: ReviewQueueData }) {
  const t = useTranslations("Dashboard.review");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const [queue, setQueue] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    const result = await fetchReviewQueue();
    if (result.ok && result.data) {
      setQueue(result.data);
      setOffline(false);
    } else {
      setOffline(true);
    }
  }, []);

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

  const items = orderReviewQueue(queue.items);

  function waitingFor(item: ReviewQueueItem): string {
    const { unit, count } = waitingUnit(
      waitingMinutes(item.waitingSince, queue.refreshedAt),
    );
    const time =
      unit === "minutes"
        ? t("waitingMinutes", { count })
        : unit === "hours"
          ? t("waitingHours", { count })
          : t("waitingDays", { count });
    return t("waiting", { time });
  }

  return (
    <div className="space-y-4">
      <p role="status" className="text-sm text-muted">
        {t("count", { count: items.length })}
      </p>

      {offline && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          <span>{t("loadFailed")}</span>
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

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-surface p-10 text-center shadow-md">
          <Inbox
            className="size-10 text-muted"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="text-lg font-semibold">{t("empty")}</p>
          <p className="text-sm text-muted">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const occasion =
              locale === "ar" ? item.occasion.nameAr : item.occasion.nameEn;
            return (
              <li key={item.id}>
                <Link
                  href={reviewHref(item.bookingId)}
                  className="block space-y-1 rounded-lg bg-surface p-4 shadow-md transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{occasion}</span>
                    {item.urgent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                        <AlertTriangle className="size-4" aria-hidden />
                        {t("urgent")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted">
                    {longDayLabel(item.day, locale)}
                    <span aria-hidden="true"> · </span>
                    <bdi className="font-mono tabular-nums">
                      {formatTime(item.start, locale)}
                    </bdi>
                    <span aria-hidden="true"> – </span>
                    <bdi className="font-mono tabular-nums">
                      {formatTime(item.end, locale)}
                    </bdi>
                  </p>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                    <span>{item.customerName}</span>
                    <span className="flex items-baseline gap-3">
                      <span className="font-mono font-semibold tabular-nums">
                        {money(locale, item.depositEgp)}
                      </span>
                      <span className="text-muted">{waitingFor(item)}</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    <bdi dir="ltr" className="font-mono">
                      {item.bookingId}
                    </bdi>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
