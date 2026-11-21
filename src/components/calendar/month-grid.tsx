"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import type { AvailabilityDay } from "@/lib/calendar-api";
import { addDays } from "@/lib/cairo-time";
import {
  addMonths,
  dayNumber,
  firstDayOfMonth,
  fullDayLabel,
  lastDayOfMonth,
  monthCells,
  monthLabel,
  monthOf,
  weekdayHeaders,
} from "@/lib/calendar-grid";

// The month grid (docs/design/views/calendar.md): a seven-column table starting
// on Saturday, with a marker for free slots, a ring for today, a struck label
// for a closed day, dimmed past days and the selected day filled with brand.
// Arrow keys move between days, Enter selects, Page Up/Down change month.

export interface MonthGridProps {
  month: string;
  days: AvailabilityDay[];
  today: string;
  selected: string;
  /** The earliest month the visitor may open; earlier control is disabled. */
  earliestMonth: string;
  onMonth: (month: string) => void;
  onSelect: (day: string) => void;
}

export function MonthGrid({
  month,
  days,
  today,
  selected,
  earliestMonth,
  onMonth,
  onSelect,
}: MonthGridProps) {
  const t = useTranslations("Calendar");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const rtl = locale === "ar";
  // The roving tab stop. The grid is keyed by month, so opening a month starts
  // on the day the page selected (today or the first open day).
  const [focusDay, setFocusDay] = useState(selected);
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const byDay = useMemo(
    () => new Map(days.map((day) => [day.day, day])),
    [days],
  );
  const cells = useMemo(() => monthCells(month), [month]);
  const headers = useMemo(() => weekdayHeaders(locale), [locale]);
  const grid = useRef<HTMLTableElement>(null);

  function dayLabel(day: string, data: AvailabilityDay | undefined): string {
    const date = fullDayLabel(day, locale);
    if (day < today) return t("dayPast", { date });
    if (data?.closed) return t("dayClosed", { date });
    if (data?.slots.some((slot) => slot.action !== "none")) {
      return t("dayFree", { date });
    }
    return t("dayFull", { date });
  }

  const canGoBack = month > earliestMonth;

  function move(day: string, step: number, event: React.KeyboardEvent) {
    const target = addDays(day, step);
    if (monthOf(target) !== month) return;
    event.preventDefault();
    setFocusDay(target);
    refs.current.get(target)?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const active = focusDay;
    const horizontal = (step: number) =>
      move(active, rtl ? -step : step, event);
    switch (event.key) {
      case "ArrowRight":
        horizontal(1);
        break;
      case "ArrowLeft":
        horizontal(-1);
        break;
      case "ArrowDown":
        move(active, 7, event);
        break;
      case "ArrowUp":
        move(active, -7, event);
        break;
      case "Home":
        move(firstDayOfMonth(month), 0, event);
        break;
      case "End": {
        const last = lastDayOfMonth(month);
        event.preventDefault();
        setFocusDay(last);
        refs.current.get(last)?.focus();
        break;
      }
      case "PageUp":
        event.preventDefault();
        if (canGoBack) onMonth(addMonths(month, -1));
        break;
      case "PageDown":
        event.preventDefault();
        onMonth(addMonths(month, 1));
        break;
    }
  }

  return (
    <section
      className="rounded-lg bg-surface p-4 shadow-md sm:p-6"
      aria-labelledby="calendar-month-heading"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={t("monthPrevious")}
          disabled={!canGoBack}
          onClick={() => onMonth(addMonths(month, -1))}
          className="flex size-12 items-center justify-center rounded-full bg-fill text-fg transition-colors hover:bg-border disabled:bg-transparent disabled:text-border motion-reduce:transition-none"
        >
          <ChevronLeft
            aria-hidden="true"
            className="size-5 rtl:-scale-x-100"
            strokeWidth={1.75}
          />
        </button>
        <h2
          id="calendar-month-heading"
          aria-live="polite"
          className="text-xl font-bold"
        >
          {monthLabel(month, locale)}
        </h2>
        <button
          type="button"
          aria-label={t("monthNext", {
            month: monthLabel(addMonths(month, 1), locale),
          })}
          onClick={() => onMonth(addMonths(month, 1))}
          className="flex size-12 items-center justify-center rounded-full bg-fill text-fg transition-colors hover:bg-border motion-reduce:transition-none"
        >
          <ChevronRight
            aria-hidden="true"
            className="size-5 rtl:-scale-x-100"
            strokeWidth={1.75}
          />
        </button>
      </div>

      <table
        ref={grid}
        role="grid"
        aria-labelledby="calendar-month-heading"
        className="w-full table-fixed border-collapse"
        onKeyDown={onKeyDown}
      >
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="py-2 text-xs font-medium text-muted"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, week) => (
            <tr key={week}>
              {cells.slice(week * 7, week * 7 + 7).map((day, column) => {
                if (!day) return <td key={`empty-${column}`} />;
                const data = byDay.get(day);
                const past = day < today;
                const closed = data?.closed ?? false;
                const hasFree =
                  data?.slots.some((slot) => slot.action !== "none") ?? false;
                const isSelected = day === selected;

                const classes = [
                  "relative mx-auto flex size-12 items-center justify-center rounded-full text-base font-medium tabular-nums transition-colors motion-reduce:transition-none",
                  !isSelected && "hover:bg-fill",
                  "disabled:cursor-default disabled:bg-transparent disabled:text-muted disabled:opacity-55",
                  isSelected
                    ? "bg-brand font-bold text-brand-fg shadow-none hover:bg-brand"
                    : closed
                      ? "text-muted line-through"
                      : "text-fg",
                  day === today
                    ? "shadow-[inset_0_0_0_2px_var(--color-border)]"
                    : "",
                ].join(" ");

                return (
                  <td
                    key={day}
                    role="gridcell"
                    aria-selected={isSelected}
                    className="py-1 text-center"
                  >
                    <button
                      ref={(element) => {
                        if (element) refs.current.set(day, element);
                        else refs.current.delete(day);
                      }}
                      type="button"
                      disabled={past}
                      aria-label={dayLabel(day, data)}
                      tabIndex={day === focusDay ? 0 : -1}
                      onClick={() => onSelect(day)}
                      onFocus={() => setFocusDay(day)}
                      className={classes}
                    >
                      {dayNumber(day)}
                      {hasFree && (
                        <span
                          aria-hidden="true"
                          className={`absolute bottom-1 size-1.5 rounded-full ${
                            isSelected ? "bg-brand-fg" : "bg-accent"
                          }`}
                        />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div
        aria-hidden="true"
        className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-sm text-muted"
      >
        <span className="inline-flex items-center gap-2">
          <i className="size-1.5 rounded-full bg-accent" />
          {t("keyFree")}
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="size-4 rounded-full shadow-[inset_0_0_0_2px_var(--color-border)]" />
          {t("keyToday")}
        </span>
        <span className="line-through">{t("keyClosed")}</span>
      </div>
    </section>
  );
}
