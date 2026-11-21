"use client";

import { Inbox, Plus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { AddBookingDialog } from "@/components/bookings/add-booking-dialog";
import { BookingDetailPanel } from "@/components/bookings/booking-detail-panel";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  fetchBookingDetail,
  fetchBookings,
  filtersToQuery,
  type AdminBookingDetail,
  type AdminBookingListItem,
  type AdminBookingSource,
  type AdminBookingStatus,
  type BookingsFilters,
  type BookingsPage,
  type StaffBookingCreated,
} from "@/lib/booking-admin-api";
import { longDayLabel } from "@/lib/calendar-grid";
import { formatTime } from "@/lib/slot-time";

import type { BookingOccasionOption } from "./add-booking-dialog";

// The bookings list and detail (docs/design/views/bookings.md). Filters live in
// the URL so a filtered view can be bookmarked; selecting a row keeps the same
// filters and adds `booking`. On a laptop the detail sits beside the list; on a
// tablet it is an overlay panel; on a phone it is the whole page.

function money(locale: "ar" | "en", amount: number): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function hasFilters(filters: BookingsFilters): boolean {
  return Boolean(
    filters.from ||
    filters.to ||
    filters.status ||
    filters.source ||
    (filters.q && filters.q.trim()),
  );
}

interface Props {
  initial: BookingsPage;
  initialFilters: BookingsFilters;
  initialDetail: AdminBookingDetail | null;
  occasions: BookingOccasionOption[];
  /** Today in the venue's time zone, the earliest date a manual entry offers. */
  today: string;
}

export function BookingsView({
  initial,
  initialFilters,
  initialDetail,
  occasions,
  today,
}: Props) {
  const t = useTranslations("Dashboard.bookings");
  const statusLabels = useTranslations("Dashboard.bookings.status");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const router = useRouter();
  const ids = {
    search: useId(),
    from: useId(),
    to: useId(),
    status: useId(),
    source: useId(),
    filters: useId(),
  };

  const [filters, setFilters] = useState(initialFilters);
  const [searchText, setSearchText] = useState(initialFilters.q ?? "");
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState(initialDetail);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoreId = useRef<string | null>(null);

  // Opening moves focus into the panel; closing returns it to the row that was
  // opened, as the view doc requires.
  useEffect(() => {
    if (detail) {
      headingRef.current?.focus();
      return;
    }
    if (restoreId.current) {
      document
        .querySelector<HTMLElement>(`[data-booking-row="${restoreId.current}"]`)
        ?.focus();
      restoreId.current = null;
    }
  }, [detail]);

  function syncUrl(next: BookingsFilters, bookingId?: string | null) {
    const params = new URLSearchParams(filtersToQuery(next).slice(1));
    if (bookingId) params.set("booking", bookingId);
    const query = params.toString();
    router.replace(`/dashboard/bookings${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  }

  async function load(next: BookingsFilters, bookingId?: string | null) {
    setLoading(true);
    const result = await fetchBookings(next);
    setLoading(false);
    if (result.ok && result.data) {
      setData(result.data);
      setOffline(false);
    } else {
      setOffline(true);
    }
    syncUrl(next, bookingId);
  }

  function applyFilters(next: BookingsFilters) {
    const cleaned = { ...next, page: 1 };
    setFilters(cleaned);
    setDetail(null);
    setDetailError(false);
    void load(cleaned);
  }

  function goToPage(page: number) {
    const next = { ...filters, page };
    setFilters(next);
    setDetail(null);
    setDetailError(false);
    void load(next);
  }

  async function openDetail(item: AdminBookingListItem) {
    restoreId.current = item.bookingId;
    setDetailError(false);
    setDetailLoading(true);
    const result = await fetchBookingDetail(item.bookingId);
    setDetailLoading(false);
    if (result.ok && result.data) {
      setDetail(result.data);
      syncUrl(filters, item.bookingId);
    } else {
      setDetailError(true);
    }
  }

  function closeDetail() {
    setDetail(null);
    setDetailError(false);
    syncUrl(filters);
  }

  async function refreshCurrent() {
    const listResult = await fetchBookings(filters);
    if (listResult.ok && listResult.data) {
      setData(listResult.data);
      setOffline(false);
    }
    const current = detail ?? initialDetail;
    if (current) {
      const detailResult = await fetchBookingDetail(current.bookingId);
      if (detailResult.ok && detailResult.data) setDetail(detailResult.data);
    }
  }

  async function onCreated(created: StaffBookingCreated) {
    setAddOpen(false);
    setNotice(t("addDialog.created", { bookingId: created.bookingId }));
    await load(filters);
    const result = await fetchBookingDetail(created.bookingId);
    if (result.ok && result.data) {
      restoreId.current = created.bookingId;
      setDetail(result.data);
      syncUrl(filters, created.bookingId);
    }
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const filtersActive = hasFilters(filters);
  const panelOpen = detail !== null || detailLoading || detailError;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Button
          type="button"
          onClick={() => setAddOpen(true)}
          className="h-(--size-touch) rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
        >
          <Plus className="size-5" aria-hidden />
          {t("add")}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <form
            className="min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters({
                ...filters,
                q: searchText.trim() ? searchText.trim() : undefined,
              });
            }}
          >
            <label
              htmlFor={ids.search}
              className="mb-1 block text-sm font-medium"
            >
              {t("search")}
            </label>
            <div className="flex gap-2">
              <input
                id={ids.search}
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={t("searchPlaceholder")}
                maxLength={100}
                className="h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-4 outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
              <Button
                type="submit"
                variant="outline"
                size="icon"
                aria-label={t("searchAction")}
                className="size-(--size-touch-dense) shrink-0 rounded-full"
              >
                <Search className="size-5" aria-hidden />
              </Button>
            </div>
          </form>
          <Button
            type="button"
            variant="outline"
            className="h-(--size-touch-dense) rounded-full md:hidden"
            aria-expanded={filtersOpen}
            aria-controls={ids.filters}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {t("filters")}
          </Button>
        </div>

        <div
          id={ids.filters}
          className={`${filtersOpen ? "grid" : "hidden"} gap-3 rounded-lg bg-surface p-4 shadow-md md:grid md:grid-cols-4 md:items-end md:bg-transparent md:p-0 md:shadow-none`}
        >
          <div className="space-y-1 text-sm">
            <label htmlFor={ids.from} className="font-medium">
              {t("from")}
            </label>
            <input
              id={ids.from}
              type="date"
              value={filters.from ?? ""}
              onChange={(event) =>
                applyFilters({
                  ...filters,
                  from: event.target.value || undefined,
                })
              }
              className="h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
              dir="ltr"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label htmlFor={ids.to} className="font-medium">
              {t("to")}
            </label>
            <input
              id={ids.to}
              type="date"
              value={filters.to ?? ""}
              onChange={(event) =>
                applyFilters({
                  ...filters,
                  to: event.target.value || undefined,
                })
              }
              className="h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
              dir="ltr"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label htmlFor={ids.status} className="font-medium">
              {t("statusFilter")}
            </label>
            <select
              id={ids.status}
              value={filters.status ?? ""}
              onChange={(event) =>
                applyFilters({
                  ...filters,
                  status:
                    (event.target.value as AdminBookingStatus) || undefined,
                })
              }
              className="h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <option value="">{t("allStatuses")}</option>
              {BOOKING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabels(status)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 text-sm">
            <label htmlFor={ids.source} className="font-medium">
              {t("sourceFilter")}
            </label>
            <select
              id={ids.source}
              value={filters.source ?? ""}
              onChange={(event) =>
                applyFilters({
                  ...filters,
                  source:
                    (event.target.value as AdminBookingSource) || undefined,
                })
              }
              className="h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <option value="">{t("allSources")}</option>
              {BOOKING_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {t(`source.${source}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-lg bg-success-soft p-3 text-sm text-success"
        >
          {notice}
        </p>
      )}

      <div
        className={
          panelOpen
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start"
            : ""
        }
      >
        <div className="min-w-0 space-y-3">
          <p role="status" className="text-sm text-muted">
            {t("count", { count: data.total })}
          </p>

          {offline && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning"
            >
              <span>{t("loadFailed")}</span>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => void load(filters)}
              >
                {t("retry")}
              </Button>
            </div>
          )}

          {loading && data.items.length === 0 ? (
            <div className="space-y-2" aria-hidden>
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className="h-14 animate-pulse rounded-lg bg-fill"
                />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg bg-surface p-10 text-center shadow-md">
              <Inbox
                className="size-10 text-muted"
                strokeWidth={1.75}
                aria-hidden
              />
              <p className="text-lg font-semibold">
                {filtersActive ? t("noMatches") : t("empty")}
              </p>
              <p className="text-sm text-muted">
                {filtersActive ? t("noMatchesHint") : t("emptyHint")}
              </p>
              {filtersActive && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setSearchText("");
                    applyFilters({});
                  }}
                >
                  {t("clearFilters")}
                </Button>
              )}
            </div>
          ) : (
            <>
              <table className="hidden w-full overflow-hidden rounded-lg bg-surface text-sm shadow-md md:table">
                <caption className="sr-only">{t("title")}</caption>
                <thead>
                  <tr className="border-b border-border text-start text-xs text-muted">
                    <th scope="col" className="p-3 text-start font-medium">
                      {t("columns.when")}
                    </th>
                    <th scope="col" className="p-3 text-start font-medium">
                      {t("columns.occasion")}
                    </th>
                    <th scope="col" className="p-3 text-start font-medium">
                      {t("columns.customer")}
                    </th>
                    <th scope="col" className="p-3 text-start font-medium">
                      {t("columns.status")}
                    </th>
                    <th scope="col" className="p-3 text-start font-medium">
                      {t("columns.source")}
                    </th>
                    <th scope="col" className="p-3 text-start font-medium">
                      {t("columns.remainder")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border last:border-0 hover:bg-fill/60"
                    >
                      <td className="p-1">
                        <button
                          type="button"
                          data-booking-row={item.bookingId}
                          aria-label={t("open", { bookingId: item.bookingId })}
                          onClick={() => void openDetail(item)}
                          className="w-full rounded-md p-2 text-start focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          <span className="block">
                            {longDayLabel(item.day, locale)}
                          </span>
                          <span className="block text-xs text-muted">
                            <bdi className="font-mono tabular-nums">
                              {formatTime(item.start, locale)}
                            </bdi>
                            <span aria-hidden="true"> – </span>
                            <bdi className="font-mono tabular-nums">
                              {formatTime(item.end, locale)}
                            </bdi>
                          </span>
                        </button>
                      </td>
                      <td className="p-3">
                        {locale === "ar"
                          ? item.occasion.nameAr
                          : item.occasion.nameEn}
                      </td>
                      <td className="p-3">
                        <span className="block">{item.customerName}</span>
                        <bdi
                          dir="ltr"
                          className="block font-mono text-xs text-muted"
                        >
                          {item.customerPhone}
                        </bdi>
                      </td>
                      <td className="p-3">
                        <BookingStatusBadge status={item.status} />
                      </td>
                      <td className="p-3 text-xs text-muted">
                        {t(`source.${item.source}`)}
                      </td>
                      <td className="p-3">
                        <span className="block font-mono tabular-nums">
                          {money(locale, item.remainderEgp)}
                        </span>
                        <span className="block text-xs text-muted">
                          {item.remainderPaid
                            ? t("remainder.paid")
                            : t("remainder.unpaid")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ul className="space-y-2 md:hidden">
                {data.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-booking-row={item.bookingId}
                      aria-label={t("open", { bookingId: item.bookingId })}
                      onClick={() => void openDetail(item)}
                      className="block w-full space-y-1 rounded-lg bg-surface p-4 text-start shadow-md focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          {locale === "ar"
                            ? item.occasion.nameAr
                            : item.occasion.nameEn}
                        </span>
                        <BookingStatusBadge status={item.status} />
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
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span>{item.customerName}</span>
                        <span className="font-mono tabular-nums">
                          {money(locale, item.remainderEgp)}
                          <span className="ms-1 text-xs text-muted">
                            {item.remainderPaid
                              ? t("remainder.paid")
                              : t("remainder.unpaid")}
                          </span>
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        {t(`source.${item.source}`)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={data.page <= 1 || loading}
                onClick={() => goToPage(data.page - 1)}
              >
                {t("previous")}
              </Button>
              <p className="text-sm text-muted" role="status">
                {t("pageOf", { page: data.page, pages })}
              </p>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={data.page >= pages || loading}
                onClick={() => goToPage(data.page + 1)}
              >
                {t("next")}
              </Button>
            </div>
          )}
        </div>

        {panelOpen && (
          <>
            <div
              aria-hidden
              className="fixed inset-0 z-20 bg-overlay lg:hidden"
              onClick={closeDetail}
            />
            <aside
              role="region"
              aria-label={t("title")}
              className="fixed inset-0 z-30 overflow-y-auto bg-bg p-4 md:inset-4 md:rounded-lg md:bg-surface md:shadow-lg lg:sticky lg:inset-auto lg:z-auto lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:rounded-lg lg:bg-surface lg:p-4 lg:shadow-md"
            >
              {detail ? (
                <BookingDetailPanel
                  detail={detail}
                  headingRef={headingRef}
                  onClose={closeDetail}
                  onMutated={() => void refreshCurrent()}
                />
              ) : detailError ? (
                <div className="space-y-3">
                  <p
                    role="alert"
                    className="rounded-lg bg-danger-soft p-3 text-sm text-danger"
                  >
                    {t("loadFailed")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={closeDetail}
                  >
                    {t("close")}
                  </Button>
                </div>
              ) : (
                <p role="status" className="text-sm text-muted">
                  {t("detail.loading")}
                </p>
              )}
            </aside>
          </>
        )}
      </div>

      <AddBookingDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        today={today}
        occasions={occasions}
        onCreated={(created) => void onCreated(created)}
      />
    </div>
  );
}
