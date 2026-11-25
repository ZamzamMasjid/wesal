"use client";

import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatTime, isValidTime } from "@/lib/slot-time";

// A clock-face time picker for the schedule editor (docs/design/views/
// schedule-editor.md). The owner taps a clock, taps the hour and then the
// minute; nothing is typed, so every value is visible and no keyboard or native
// time control can leave the field blank.

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const DEFAULT_TIME = "14:00";

function partsOf(time: string): { hour24: number; minute: number } {
  const [hour24, minute] = time.split(":").map(Number);
  return { hour24: hour24 ?? 0, minute: minute ?? 0 };
}

/** A 12-hour reading plus the day period, as one `HH:MM` the API stores. */
function toTime(hour12: number, minute: number, pm: boolean): string {
  const hour24 = (hour12 % 12) + (pm ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Where a clock-face button sits: index 0 at 12 o'clock, then clockwise. */
function facePosition(index: number, total: number): CSSProperties {
  const radians = ((index * 360) / total) * (Math.PI / 180);
  return {
    left: `${50 + 40 * Math.sin(radians)}%`,
    top: `${50 - 40 * Math.cos(radians)}%`,
  };
}

/** The hand points at the selected value even when it is not a face button. */
function handStyle(degrees: number): CSSProperties {
  return { transform: `rotate(${degrees - 90}deg)` };
}

export function TimePicker({
  label,
  value,
  invalid = false,
  onChange,
}: {
  /** The field's name, e.g. "Start time"; also the dialog title. */
  label: string;
  /** `HH:MM`; an invalid or empty value opens the picker at a default. */
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("Dashboard.schedule");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_TIME);
  const [mode, setMode] = useState<"hours" | "minutes">("hours");

  const shown = isValidTime(value)
    ? formatTime(value, locale)
    : t("chooseTime");

  function changeOpen(next: boolean) {
    if (next) {
      setDraft(isValidTime(value) ? value : DEFAULT_TIME);
      setMode("hours");
    }
    setOpen(next);
  }

  const { hour24, minute } = partsOf(draft);
  const hour12 = hour24 % 12 || 12;
  const pm = hour24 >= 12;
  const handDegrees = mode === "hours" ? (hour12 % 12) * 30 : minute * 6;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={`inline-flex h-(--size-touch-dense) w-full min-w-0 items-center justify-center rounded-full border bg-surface ps-2 pe-2 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            invalid ? "border-danger" : "border-border"
          }`}
        >
          <bdi className="truncate">{shown}</bdi>
        </button>
      </DialogTrigger>

      <DialogContent
        className="w-[min(92vw,24rem)] p-4 sm:p-6"
        closeLabel={t("closeDialog")}
      >
        <DialogTitle className="flex items-center gap-2">
          <Clock className="size-5 text-brand" aria-hidden />
          {label}
        </DialogTitle>
        <DialogDescription>{t("clockHint")}</DialogDescription>

        <div className="mt-4 space-y-4">
          <p
            aria-live="polite"
            className="text-center text-3xl font-bold tabular-nums"
          >
            <bdi>{formatTime(draft, locale)}</bdi>
          </p>

          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <div
              role="group"
              aria-label={t("clockMode")}
              className="inline-flex rounded-full bg-fill p-1"
            >
              {(["hours", "minutes"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                  className={`rounded-full px-3 py-1 font-medium ${
                    mode === option
                      ? "bg-brand text-brand-fg"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {t(option === "hours" ? "hour" : "minute")}
                </button>
              ))}
            </div>
            <div
              role="group"
              aria-label={t("clockPeriod")}
              className="inline-flex rounded-full border border-border bg-surface p-1"
            >
              {[false, true].map((isPm) => (
                <button
                  key={String(isPm)}
                  type="button"
                  aria-pressed={pm === isPm}
                  onClick={() => setDraft(toTime(hour12, minute, isPm))}
                  className={`rounded-full px-3 py-1 font-medium ${
                    pm === isPm
                      ? "bg-brand text-brand-fg"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {t(isPm ? "periodPm" : "periodAm")}
                </button>
              ))}
            </div>
          </div>

          <div
            dir="ltr"
            role="group"
            aria-label={t(mode === "hours" ? "hour" : "minute")}
            className="relative mx-auto size-56 max-w-full rounded-full border border-border bg-fill/50 sm:size-64"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute start-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
            />
            <span
              aria-hidden="true"
              data-hand="true"
              className="pointer-events-none absolute start-1/2 top-1/2 h-0.5 w-[38%] origin-left rounded-full bg-brand/50"
              style={handStyle(handDegrees)}
            />
            {(mode === "hours" ? HOURS : MINUTES).map((item, index, all) => {
              const selected =
                mode === "hours" ? item === hour12 : item === minute;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={selected}
                  aria-label={
                    mode === "hours"
                      ? t("chooseHour", { hour: item })
                      : t("chooseMinute", {
                          minute: String(item).padStart(2, "0"),
                        })
                  }
                  onClick={() => {
                    if (mode === "hours") {
                      setDraft(toTime(item, minute, pm));
                      setMode("minutes");
                    } else {
                      setDraft(toTime(hour12, item, pm));
                    }
                  }}
                  style={facePosition(index, all.length)}
                  className={`absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
                    selected
                      ? "bg-brand text-brand-fg"
                      : "text-fg hover:bg-surface"
                  }`}
                >
                  {mode === "hours" ? item : String(item).padStart(2, "0")}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-full">
                {t("cancel")}
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                type="button"
                className="rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
                onClick={() => onChange(draft)}
              >
                {t("clockConfirm")}
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
