"use client";

import { ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  fetchReports,
  reportExportHref,
  type ReportMonthLine,
  type ReportOccasionLine,
  type ReportsSummary,
} from "@/lib/reports-api";
import {
  isValidPeriod,
  periodFromRange,
  periodRange,
  shiftPeriod,
  type ReportPeriod,
} from "@/lib/reports-period";

// Owner reports (docs/design/views/reports.md): pick a month, a year or a range
// and read confirmed bookings, income, deposits and remainders, by occasion and
// by month. Every chart carries a table with the same figures; no information
// depends on color. Period changes reload every figure together.

type Kind = ReportPeriod["kind"];

function monthLabel(month: string, locale: string): string {
  return new Intl.DateTimeFormat(
    locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
    { month: "long", year: "numeric" },
  ).format(new Date(`${month}-01T00:00:00Z`));
}

export function ReportsView({
  initial,
  initialPeriod,
}: {
  initial: ReportsSummary;
  initialPeriod: ReportPeriod;
}) {
  const t = useTranslations("Dashboard.reports");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const numberTag = locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB";
  const number = new Intl.NumberFormat(numberTag);
  const money = new Intl.NumberFormat(numberTag, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });

  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [data, setData] = useState<ReportsSummary>(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestRef = useRef(0);
  const range = periodRange(period);

  async function load(next: ReportPeriod) {
    if (!isValidPeriod(next)) return;
    const bounds = periodRange(next);
    const request = ++requestRef.current;
    setPeriod(next);
    setLoading(true);
    setFailed(false);
    const result = await fetchReports(bounds.from, bounds.to);
    if (request !== requestRef.current) return;
    setLoading(false);
    if (result.ok && result.data) {
      setData(result.data);
      return;
    }
    setFailed(true);
  }

  function changeKind(kind: Kind) {
    if (kind === period.kind) return;
    void load(
      kind === "range"
        ? { kind: "range", from: range.from, to: range.to }
        : periodFromRange(kind, range),
    );
  }

  const kindButton = (kind: Kind, label: string) => (
    <button
      key={kind}
      type="button"
      aria-pressed={period.kind === kind}
      onClick={() => changeKind(kind)}
      className={`h-(--size-touch-dense) rounded-full px-4 text-sm font-medium transition-colors motion-reduce:transition-none ${
        period.kind === kind
          ? "bg-brand text-brand-fg"
          : "bg-surface text-fg hover:bg-fill"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>

      <div className="space-y-3 rounded-lg bg-surface p-4 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t("previous")}
              onClick={() => void load(shiftPeriod(period, -1))}
              className="flex size-12 items-center justify-center rounded-full bg-fill text-fg hover:bg-border motion-reduce:transition-none"
            >
              <ChevronLeft
                aria-hidden="true"
                className="size-5 rtl:-scale-x-100"
                strokeWidth={1.75}
              />
            </button>
            <p
              aria-live="polite"
              className="min-w-40 text-center font-semibold tabular-nums"
            >
              {period.kind === "month"
                ? monthLabel(period.month, locale)
                : `${range.from} – ${range.to}`}
            </p>
            <button
              type="button"
              aria-label={t("next")}
              onClick={() => void load(shiftPeriod(period, 1))}
              className="flex size-12 items-center justify-center rounded-full bg-fill text-fg hover:bg-border motion-reduce:transition-none"
            >
              <ChevronRight
                aria-hidden="true"
                className="size-5 rtl:-scale-x-100"
                strokeWidth={1.75}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label={t("period")}
              className="flex gap-1 rounded-full bg-surface p-1 shadow-sm"
            >
              {kindButton("month", t("modeMonth"))}
              {kindButton("range", t("modeRange"))}
              {kindButton("year", t("modeYear"))}
            </div>
            <a
              href={reportExportHref(data.from, data.to)}
              download
              className="inline-flex h-(--size-touch-dense) items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
            >
              <Download
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              {t("export")}
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 text-sm">
          {period.kind === "month" && (
            <label className="space-y-1">
              <span className="block font-medium">{t("month")}</span>
              <input
                type="month"
                value={period.month}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) void load({ kind: "month", month: value });
                }}
                className="h-(--size-touch-dense) rounded-full border border-border bg-surface px-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                dir="ltr"
              />
            </label>
          )}
          {period.kind === "year" && (
            <label className="space-y-1">
              <span className="block font-medium">{t("year")}</span>
              <input
                type="number"
                min={2000}
                max={2100}
                value={period.year}
                onChange={(event) => {
                  const year = event.target.value;
                  if (year) void load({ kind: "year", year });
                }}
                className="h-(--size-touch-dense) w-28 rounded-full border border-border bg-surface px-3 outline-none focus-visible:ring-2 focus-visible:ring-focus tabular-nums"
                dir="ltr"
              />
            </label>
          )}
          {period.kind === "range" && (
            <>
              <label className="space-y-1">
                <span className="block font-medium">{t("from")}</span>
                <input
                  type="date"
                  value={period.from}
                  onChange={(event) =>
                    void load({ ...period, from: event.target.value })
                  }
                  className="h-(--size-touch-dense) rounded-full border border-border bg-surface px-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  dir="ltr"
                />
              </label>
              <label className="space-y-1">
                <span className="block font-medium">{t("to")}</span>
                <input
                  type="date"
                  value={period.to}
                  onChange={(event) =>
                    void load({ ...period, to: event.target.value })
                  }
                  className="h-(--size-touch-dense) rounded-full border border-border bg-surface px-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  dir="ltr"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft p-4 text-danger"
        >
          <span>{t("loadFailed")}</span>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => void load(period)}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {t("retry")}
          </Button>
        </div>
      ) : loading ? (
        <ReportsSkeleton label={t("loading")} />
      ) : (
        <>
          <Tiles data={data} money={money} number={number} />

          {data.bookings === 0 ? (
            <p className="rounded-lg bg-surface p-6 text-center text-muted shadow-md">
              {t("empty")}
            </p>
          ) : (
            <>
              <ChartSection title={t("byOccasion")}>
                {data.byOccasion.map((entry) => (
                  <BarRow
                    key={entry.occasionId}
                    label={locale === "ar" ? entry.nameAr : entry.nameEn}
                    count={entry.bookings}
                    max={Math.max(...data.byOccasion.map((e) => e.bookings))}
                    number={number}
                    note={money.format(entry.incomeEgp)}
                    href={`/dashboard/bookings?from=${data.from}&to=${data.to}&occasionId=${entry.occasionId}`}
                  />
                ))}
              </ChartSection>
              <OccasionTable
                lines={data.byOccasion}
                locale={locale}
                number={number}
                money={money}
                from={data.from}
                to={data.to}
              />

              {data.byMonth.length > 1 && (
                <>
                  <ChartSection title={t("byMonth")}>
                    {data.byMonth.map((entry) => (
                      <BarRow
                        key={entry.month}
                        label={monthLabel(entry.month, locale)}
                        count={entry.bookings}
                        max={Math.max(...data.byMonth.map((e) => e.bookings))}
                        number={number}
                        note={money.format(entry.incomeEgp)}
                      />
                    ))}
                  </ChartSection>
                  <MonthTable
                    lines={data.byMonth}
                    locale={locale}
                    number={number}
                    money={money}
                  />
                </>
              )}
            </>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-lg bg-surface p-4 shadow-md">
              <h2 className="font-semibold">{t("source")}</h2>
              <p className="mt-1 text-muted">
                {t("sourceSplit", {
                  online: number.format(data.bySource.online),
                  staff: number.format(data.bySource.staff),
                })}
              </p>
            </section>
            <section className="rounded-lg bg-surface p-4 shadow-md">
              <h2 className="font-semibold">{t("notCompleted")}</h2>
              <p className="mt-1 text-muted">
                {t("notCompletedBody", {
                  expired: number.format(data.expired),
                  rejected: number.format(data.rejected),
                })}
              </p>
              {data.cancelled > 0 && (
                <p className="mt-1 text-sm text-muted">
                  {t("cancelled", { count: data.cancelled })}
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function Tiles({
  data,
  money,
  number,
}: {
  data: ReportsSummary;
  money: Intl.NumberFormat;
  number: Intl.NumberFormat;
}) {
  const t = useTranslations("Dashboard.reports");
  const tiles = [
    {
      label: t("tileBookings"),
      value: number.format(data.bookings),
      unit: t("confirmed"),
    },
    { label: t("tileIncome"), value: money.format(data.incomeEgp) },
    { label: t("tileDeposits"), value: money.format(data.depositEgp) },
    {
      label: t("tileOutstanding"),
      value: money.format(data.remainderOutstandingEgp),
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((tile) => (
        <li key={tile.label} className="rounded-lg bg-surface p-4 shadow-md">
          <span className="block text-sm text-muted">{tile.label}</span>
          <span className="mt-1 block font-mono text-2xl font-bold tabular-nums">
            {tile.value}
          </span>
          {"unit" in tile && tile.unit && (
            <span className="block text-xs text-muted">{tile.unit}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ChartSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg bg-surface p-4 shadow-md">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function BarRow({
  label,
  count,
  max,
  number,
  note,
  href,
}: {
  label: string;
  count: number;
  max: number;
  number: Intl.NumberFormat;
  note: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="w-36 shrink-0 truncate text-sm">{label}</span>
      <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-fill">
        <span
          className="absolute inset-y-0 start-0 rounded-full bg-brand"
          style={{ width: `${max === 0 ? 0 : (count / max) * 100}%` }}
        />
      </span>
      <span className="w-10 text-end text-sm font-semibold tabular-nums">
        {number.format(count)}
      </span>
      <span className="w-24 text-end text-sm text-muted tabular-nums">
        {note}
      </span>
    </>
  );

  return href ? (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-sm px-1 py-1 hover:bg-fill"
    >
      {content}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-1 py-1">{content}</div>
  );
}

function OccasionTable({
  lines,
  locale,
  number,
  money,
  from,
  to,
}: {
  lines: ReportOccasionLine[];
  locale: "ar" | "en";
  number: Intl.NumberFormat;
  money: Intl.NumberFormat;
  from: string;
  to: string;
}) {
  const t = useTranslations("Dashboard.reports");

  return (
    <div className="overflow-x-auto rounded-lg bg-surface p-4 shadow-md">
      <table className="w-full text-sm">
        <caption className="mb-2 text-start font-semibold">
          {t("byOccasion")}
        </caption>
        <thead>
          <tr className="text-start text-muted">
            <th scope="col" className="py-1 text-start font-medium">
              {t("occasion")}
            </th>
            <th scope="col" className="py-1 text-end font-medium">
              {t("bookings")}
            </th>
            <th scope="col" className="py-1 text-end font-medium">
              {t("income")}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((entry) => (
            <tr key={entry.occasionId} className="border-t border-border">
              <th scope="row" className="py-1 text-start font-normal">
                <Link
                  href={`/dashboard/bookings?from=${from}&to=${to}&occasionId=${entry.occasionId}`}
                  className="hover:text-brand"
                >
                  {locale === "ar" ? entry.nameAr : entry.nameEn}
                </Link>
              </th>
              <td className="py-1 text-end tabular-nums">
                {number.format(entry.bookings)}
              </td>
              <td className="py-1 text-end tabular-nums">
                {money.format(entry.incomeEgp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthTable({
  lines,
  locale,
  number,
  money,
}: {
  lines: ReportMonthLine[];
  locale: "ar" | "en";
  number: Intl.NumberFormat;
  money: Intl.NumberFormat;
}) {
  const t = useTranslations("Dashboard.reports");

  return (
    <div className="overflow-x-auto rounded-lg bg-surface p-4 shadow-md">
      <table className="w-full text-sm">
        <caption className="mb-2 text-start font-semibold">
          {t("byMonth")}
        </caption>
        <thead>
          <tr className="text-start text-muted">
            <th scope="col" className="py-1 text-start font-medium">
              {t("month")}
            </th>
            <th scope="col" className="py-1 text-end font-medium">
              {t("bookings")}
            </th>
            <th scope="col" className="py-1 text-end font-medium">
              {t("income")}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((entry) => (
            <tr key={entry.month} className="border-t border-border">
              <th scope="row" className="py-1 text-start font-normal">
                {monthLabel(entry.month, locale)}
              </th>
              <td className="py-1 text-end tabular-nums">
                {number.format(entry.bookings)}
              </td>
              <td className="py-1 text-end tabular-nums">
                {money.format(entry.incomeEgp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportsSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="space-y-3">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="h-24 animate-pulse rounded-lg bg-fill" />
        ))}
      </ul>
      <div className="h-48 animate-pulse rounded-lg bg-fill" />
      <p role="status" className="text-sm text-muted">
        {label}
      </p>
    </div>
  );
}
