"use client";

import { AlertTriangle, CalendarX, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchAvailability, type AvailabilitySlot } from "@/lib/calendar-api";
import { cairoParts } from "@/lib/cairo-time";
import {
  createStaffBooking,
  type StaffBookingCreated,
} from "@/lib/booking-admin-api";
import { formatTime } from "@/lib/slot-time";

// The add-booking dialog (docs/features/booking-management): a caller or walk-in
// entry. The chosen date's times come from the same availability read the public
// calendar uses, so taken slots are visible but not selectable; the server still
// decides a race and answers SLOT_TAKEN with who holds the slot and until when.

export interface BookingOccasionOption {
  id: number;
  nameAr: string;
  nameEn: string;
  priceEgp: number;
}

interface Holder {
  bookingId?: string;
  status?: string;
  customerName?: string;
  deadlineAt?: string | null;
}

type SlotsState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; closed: boolean; slots: AvailabilitySlot[] };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `YYYY-MM-DD`, the venue's today; the earliest date the dialog offers. */
  today: string;
  occasions: BookingOccasionOption[];
  onCreated: (booking: StaffBookingCreated) => void;
}

const inputClass =
  "h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-4 outline-none focus-visible:ring-2 focus-visible:ring-focus";

export function AddBookingDialog({
  open,
  onOpenChange,
  today,
  occasions,
  onCreated,
}: Props) {
  const t = useTranslations("Dashboard.bookings.addDialog");
  const slotStates = useTranslations("Calendar.states");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const ids = {
    date: useId(),
    occasion: useId(),
    name: useId(),
    phone: useId(),
    note: useId(),
  };

  const [day, setDay] = useState(today);
  const [slots, setSlots] = useState<SlotsState>({ kind: "loading" });
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [occasionId, setOccasionId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holder, setHolder] = useState<Holder | null>(null);
  const [invalidPhone, setInvalidPhone] = useState(false);

  const loadSlots = useCallback(async (date: string) => {
    setSlots({ kind: "loading" });
    const result = await fetchAvailability(date, date);
    if (!result.ok || !result.data) {
      setSlots({ kind: "error" });
      return;
    }
    const resolved = result.data.days[0];
    setSlots({
      kind: "ready",
      closed: resolved?.closed ?? false,
      slots: resolved?.slots ?? [],
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    // The answer becomes the next state; the dialog opens straight into loading.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSlots(day);
  }, [open, day, loadSlots]);

  function reset() {
    setDay(today);
    setSelected(null);
    setOccasionId("");
    setName("");
    setPhone("");
    setNote("");
    setError(null);
    setHolder(null);
    setInvalidPhone(false);
    setPending(false);
  }

  function changeOpen(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  const nowParts = cairoParts(new Date());
  const ended = (slot: AvailabilitySlot): boolean =>
    day < nowParts.day || (day === nowParts.day && slot.end <= nowParts.time);

  async function submit() {
    if (pending) return;
    setInvalidPhone(false);
    if (!selected || !occasionId || !name.trim() || !phone.trim()) {
      setError(t("required"));
      return;
    }
    setPending(true);
    setError(null);
    setHolder(null);
    const result = await createStaffBooking({
      day,
      start: selected.start,
      end: selected.end,
      occasionId: Number(occasionId),
      name: name.trim(),
      phone: phone.trim(),
      note: note.trim() ? note.trim() : undefined,
    });
    setPending(false);
    if (result.ok && result.data) {
      reset();
      onCreated(result.data);
      return;
    }
    const code = result.error?.code;
    if (code === "SLOT_TAKEN") {
      const details = result.error?.details as { holder?: Holder } | undefined;
      setHolder(details?.holder ?? {});
      setError(null);
      void loadSlots(day);
      return;
    }
    if (code === "SLOT_UNAVAILABLE") {
      setError(t("slotUnavailable"));
      void loadSlots(day);
      return;
    }
    if (code === "OCCASION_UNAVAILABLE") {
      setError(t("occasionUnavailable"));
      return;
    }
    if (code === "VALIDATION_FAILED") {
      setInvalidPhone(true);
      setError(t("invalidPhone"));
      return;
    }
    setError(t("failed"));
  }

  function holderText(entry: Holder): string {
    const who = entry.customerName ?? "";
    if (entry.deadlineAt) {
      const time = cairoParts(new Date(entry.deadlineAt)).time;
      return t("slotHeldBy", { name: who, time: formatTime(time, locale) });
    }
    return t("slotConfirmedBy", { name: who });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="w-[min(96vw,36rem)]" closeLabel={t("cancel")}>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("intro")}</DialogDescription>

        <div className="mt-4 space-y-4">
          <div className="space-y-1 text-sm">
            <label htmlFor={ids.date} className="font-medium">
              {t("date")}
            </label>
            <input
              id={ids.date}
              type="date"
              min={today}
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
                setSelected(null);
                setHolder(null);
              }}
              className={inputClass}
              dir="ltr"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">{t("slots")}</legend>
            {slots.kind === "loading" ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("slotsLoading")}
              </p>
            ) : slots.kind === "error" ? (
              <p
                role="alert"
                className="rounded-lg bg-danger-soft p-3 text-sm text-danger"
              >
                {t("slotsFailed")}
              </p>
            ) : slots.closed ? (
              <p className="flex items-center gap-2 rounded-lg bg-fill p-3 text-sm">
                <CalendarX className="size-5 text-muted" aria-hidden />
                {t("closed")}
              </p>
            ) : slots.slots.length === 0 ? (
              <p className="rounded-lg bg-fill p-3 text-sm">{t("noSlots")}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {slots.slots.map((slot) => {
                  const taken = slot.state !== "free";
                  const unavailable = taken || ended(slot);
                  const isSelected =
                    selected?.start === slot.start &&
                    selected?.end === slot.end;
                  return (
                    <li key={`${slot.start}-${slot.end}`}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`${formatTime(slot.start, locale)} – ${formatTime(
                          slot.end,
                          locale,
                        )}, ${slotStates(slot.state)}`}
                        disabled={unavailable}
                        onClick={() => {
                          setSelected(slot);
                          setHolder(null);
                        }}
                        className={`min-h-(--size-touch) w-full rounded-full px-3 py-2 text-start text-sm transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
                          isSelected
                            ? "bg-brand text-brand-fg"
                            : unavailable
                              ? "cursor-not-allowed bg-fill text-muted"
                              : "bg-accent-soft text-accent hover:brightness-95"
                        } ${unavailable && !isSelected ? "opacity-70" : ""}`}
                      >
                        <span className="block font-mono font-semibold tabular-nums">
                          <bdi>
                            {formatTime(slot.start, locale)} –{" "}
                            {formatTime(slot.end, locale)}
                          </bdi>
                        </span>
                        <span className="block text-xs">
                          {slotStates(slot.state)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <div className="space-y-1 text-sm">
            <label htmlFor={ids.occasion} className="font-medium">
              {t("occasion")}
            </label>
            <select
              id={ids.occasion}
              value={occasionId}
              onChange={(event) => setOccasionId(event.target.value)}
              className={inputClass}
            >
              <option value="">{t("chooseOccasion")}</option>
              {occasions.map((occasion) => (
                <option key={occasion.id} value={occasion.id}>
                  {locale === "ar" ? occasion.nameAr : occasion.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <label htmlFor={ids.name} className="font-medium">
                {t("name")}
              </label>
              <input
                id={ids.name}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={120}
                className={inputClass}
              />
            </div>
            <div className="space-y-1 text-sm">
              <label htmlFor={ids.phone} className="font-medium">
                {t("phone")}
              </label>
              <input
                id={ids.phone}
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                aria-invalid={invalidPhone || undefined}
                aria-describedby={`${ids.phone}-hint`}
                className={`${inputClass} ${invalidPhone ? "border-danger" : ""}`}
              />
              <p id={`${ids.phone}-hint`} className="text-xs text-muted">
                {t("phoneHint")}
              </p>
            </div>
          </div>

          <div className="space-y-1 text-sm">
            <label htmlFor={ids.note} className="font-medium">
              {t("note")}
            </label>
            <textarea
              id={ids.note}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={2}
              aria-describedby={`${ids.note}-hint`}
              className="w-full rounded-lg border border-border bg-surface p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            <p id={`${ids.note}-hint`} className="text-xs text-muted">
              {t("noteHint")}
            </p>
          </div>

          {holder && (
            <div className="flex gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
              <AlertTriangle className="size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">{t("slotTakenNotice")}</p>
                <p>{holderText(holder)}</p>
              </div>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-danger-soft p-3 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={pending}
              >
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={pending}
              className="rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
            >
              {pending ? t("submitting") : t("submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
