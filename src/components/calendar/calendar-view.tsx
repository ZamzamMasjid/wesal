"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAvailability, type Availability } from "@/lib/calendar-api";
import {
  defaultDay,
  firstDayOfMonth,
  firstOpenDay,
  lastDayOfMonth,
  monthOf,
} from "@/lib/calendar-grid";
import { formatTime } from "@/lib/slot-time";

import { ContactButtons, ContactLine } from "./contact-fallback";
import { DayPanel } from "./day-panel";
import { Legend } from "./legend";
import { MonthGrid } from "./month-grid";

// The calendar page's client half (docs/features/public-calendar): one month is
// loaded at a time, refreshed every 30 seconds while the tab is visible and on
// regaining focus (ADR-014). A refresh keeps the previous states on screen; only
// the first failure replaces the cards with the error moment.

const POLL_INTERVAL_MS = 30_000;

export function CalendarView({ initial }: { initial: Availability }) {
  const t = useTranslations("Calendar");
  const locale = useLocale() === "ar" ? "ar" : "en";

  const [data, setData] = useState(initial);
  const [month, setMonth] = useState(() => monthOf(initial.from));
  const [selected, setSelected] = useState(() =>
    firstOpenDay(initial.days, initial.today),
  );
  const [failed, setFailed] = useState(false);
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");

  const dataRef = useRef(initial);
  const selectedRef = useRef(selected);
  const requestRef = useRef(0);
  const firstRender = useRef(true);
  const wantsHeadingFocus = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const clearPop = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const load = useCallback(
    async (targetMonth: string, background: boolean) => {
      const request = ++requestRef.current;
      if (!background) setFailed(false);

      const result = await fetchAvailability(
        firstDayOfMonth(targetMonth),
        lastDayOfMonth(targetMonth),
      );
      if (request !== requestRef.current) return;

      if (!result.ok || !result.data) {
        // A background failure leaves the previous states untouched.
        if (!background) setFailed(true);
        return;
      }

      const next = result.data;
      const previous = dataRef.current;
      const popping = new Set<string>();
      const notices: string[] = [];

      for (const day of next.days) {
        const before = previous.days.find((d) => d.day === day.day);
        if (!before) continue;
        for (const slot of day.slots) {
          const old = before.slots.find((s) => s.start === slot.start);
          if (!old || old.state === slot.state) continue;
          popping.add(`${day.day}|${slot.start}`);
          if (day.day === selectedRef.current) {
            notices.push(
              t("slotChanged", {
                time: formatTime(slot.start, locale),
                state: t(`states.${slot.state}`),
              }),
            );
          }
        }
      }

      dataRef.current = next;
      setData(next);
      setFailed(false);

      if (popping.size > 0) {
        setChanged(popping);
        if (clearPop.current) clearTimeout(clearPop.current);
        clearPop.current = setTimeout(() => setChanged(new Set()), 700);
      }
      if (notices.length > 0) setAnnouncement(notices.join(". "));
    },
    [locale, t],
  );

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // Open the month the server rendered; later month changes fetch their own.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void loadRef.current(month, false);
  }, [month]);

  // Polling: every 30 seconds while visible, and at once on focus or when the
  // tab comes back. An interval in the background would only waste requests.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void loadRef.current(month, true);
      }
    };
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [month]);

  useEffect(
    () => () => {
      if (clearPop.current) clearTimeout(clearPop.current);
    },
    [],
  );

  // Selecting a day moves focus to its heading (calendar accessibility).
  useEffect(() => {
    if (!wantsHeadingFocus.current) return;
    wantsHeadingFocus.current = false;
    headingRef.current?.focus();
  }, [selected]);

  function selectDay(day: string) {
    if (day === selected) {
      headingRef.current?.focus();
      return;
    }
    wantsHeadingFocus.current = true;
    setSelected(day);
  }

  function changeMonth(next: string) {
    setMonth(next);
    setSelected(defaultDay(next, data.today));
  }

  const ready = monthOf(data.from) === month;
  const showError = failed && !ready;
  const day = ready
    ? data.days.find((entry) => entry.day === selected)
    : undefined;

  return (
    <>
      {showError ? (
        <section
          role="alert"
          aria-labelledby="calendar-error-heading"
          className="mx-auto max-w-[640px] rounded-lg bg-surface p-6 shadow-md"
        >
          <div className="flex flex-col items-center px-2 py-8 text-center sm:py-10">
            <span
              aria-hidden="true"
              className="inline-flex size-16 items-center justify-center rounded-full bg-danger-soft text-danger"
            >
              <AlertTriangle className="size-7" strokeWidth={1.75} />
            </span>
            <h2 id="calendar-error-heading" className="mt-4 text-xl font-bold">
              {t("errorTitle")}
            </h2>
            <p className="mt-1 max-w-[36ch] text-muted">{t("errorBody")}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void load(month, false)}
                className="inline-flex min-h-(--size-touch) items-center justify-center gap-2 rounded-full bg-brand px-6 font-semibold text-brand-fg transition-colors hover:bg-brand-hover motion-reduce:transition-none"
              >
                <RefreshCw
                  aria-hidden="true"
                  className="size-5"
                  strokeWidth={1.75}
                />
                {t("retry")}
              </button>
            </div>
            <div className="mt-3">
              <ContactButtons />
            </div>
          </div>
        </section>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-[5fr_7fr] md:gap-6">
          {ready ? (
            <>
              <MonthGrid
                key={month}
                month={month}
                days={data.days}
                today={data.today}
                selected={selected}
                earliestMonth={monthOf(data.today)}
                onMonth={changeMonth}
                onSelect={selectDay}
              />
              <DayPanel
                day={selected}
                data={day}
                today={data.today}
                changed={changed}
                headingRef={headingRef}
              />
            </>
          ) : (
            <>
              <MonthSkeleton />
              <DaySkeleton />
            </>
          )}
        </div>
      )}

      {!showError && (
        <div className="mt-6 flex flex-col gap-4">
          <Legend />
          <ContactLine />
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

function MonthSkeleton() {
  return (
    <section
      aria-busy="true"
      className="rounded-lg bg-surface p-4 shadow-md sm:p-6"
    >
      <div className="mx-auto mb-6 h-5 w-2/5 animate-pulse rounded-full bg-fill" />
      <div className="grid grid-cols-7 gap-y-2">
        {Array.from({ length: 35 }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="mx-auto size-(--size-touch-dense) animate-pulse rounded-full bg-fill"
          />
        ))}
      </div>
    </section>
  );
}

function DaySkeleton() {
  const t = useTranslations("Calendar");

  return (
    <section
      aria-busy="true"
      className="rounded-lg bg-surface p-4 shadow-md sm:p-6"
    >
      <div className="mb-5 h-5 w-1/2 animate-pulse rounded-full bg-fill" />
      <div className="grid gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-[68px] animate-pulse rounded-lg bg-fill sm:rounded-full"
          />
        ))}
      </div>
      <p
        role="status"
        className="mt-4 flex items-center gap-2 text-sm text-muted"
      >
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-border border-t-brand"
        />
        {t("loading")}
      </p>
    </section>
  );
}
