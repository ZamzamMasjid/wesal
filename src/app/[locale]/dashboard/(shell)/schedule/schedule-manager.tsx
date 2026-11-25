"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/schedule/time-picker";
import {
  WEEK_ORDER,
  formatDay,
  formatTime,
  isValidTime,
  nextSlot,
  slotProblems,
  sortSlots,
  weekdayName,
  type EditableSlot,
  type SlotProblem,
} from "@/lib/slot-time";

interface PatternSlot extends EditableSlot {
  weekday: number;
}

interface DateException {
  day: string;
  closed: boolean;
  note: string | null;
  slots: EditableSlot[];
}

interface ConflictBooking {
  id: number;
  startsAt: string;
  endsAt: string;
}

interface Issue {
  path: string;
  message: string;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    details?: { bookings?: ConflictBooking[]; issues?: Issue[] };
  };
}

async function call<T>(
  url: string,
  method: string,
  body?: unknown,
): Promise<Envelope<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return (await response.json()) as Envelope<T>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}

type Week = Record<number, EditableSlot[]>;
type Message = { ok: boolean; text: string } | null;

const inputClass =
  "h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-3 outline-none focus-visible:ring-2 focus-visible:ring-focus";
const cardClass = "space-y-3 rounded-lg bg-surface p-4 shadow-md";

function toWeek(slots: PatternSlot[]): Week {
  const week: Week = {};
  for (const day of WEEK_ORDER) week[day] = [];
  for (const s of slots) {
    week[s.weekday]!.push({ start: s.start, end: s.end });
  }
  return week;
}

function fromWeek(week: Week): PatternSlot[] {
  return WEEK_ORDER.flatMap((weekday) =>
    sortSlots(week[weekday] ?? []).map((s) => ({ weekday, ...s })),
  );
}

/** Today's date in the venue's timezone, as the earliest date an exception may have. */
function todayInCairo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(),
  );
}

function weekdayOfDay(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

function Notice({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      role={message.ok ? "status" : "alert"}
      className={
        "rounded-sm p-3 text-sm " +
        (message.ok
          ? "bg-success-soft text-success"
          : "bg-danger-soft text-danger")
      }
    >
      {message.text}
    </p>
  );
}

/** Two time pickers and a remove button. Times are left-to-right in both languages. */
function SlotEditor({
  slot,
  problem,
  label,
  onChange,
  onRemove,
}: {
  slot: EditableSlot;
  problem?: SlotProblem;
  label: string;
  onChange: (slot: EditableSlot) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("Dashboard.schedule");
  return (
    <div role="group" aria-label={label} className="space-y-1">
      <div className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center md:flex-col md:items-stretch">
        <TimePicker
          label={t("start")}
          value={slot.start}
          invalid={Boolean(problem)}
          onChange={(start) => onChange({ ...slot, start })}
        />
        <span
          aria-hidden="true"
          className="hidden text-center sm:inline md:hidden"
        >
          –
        </span>
        <TimePicker
          label={t("end")}
          value={slot.end}
          invalid={Boolean(problem)}
          onChange={(end) => onChange({ ...slot, end })}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          aria-label={t("removeSlot", { label })}
          onClick={onRemove}
        >
          ×
        </Button>
      </div>
      {problem && (
        <p role="alert" data-slot-error className="text-sm text-danger">
          {t(`problem.${problem}`)}
        </p>
      )}
    </div>
  );
}

function ConflictPanel({
  bookings,
  locale,
}: {
  bookings: ConflictBooking[] | null;
  locale: string;
}) {
  const t = useTranslations("Dashboard.schedule");
  if (!bookings) return null;
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  });
  return (
    <div
      role="alert"
      className="space-y-2 rounded-sm bg-danger-soft p-3 text-sm text-danger"
    >
      <p className="font-bold">{t("conflictTitle")}</p>
      <p>{t("conflictHint")}</p>
      <ul className="list-disc ps-5">
        {bookings.map((b) => (
          <li key={b.id} dir="auto">
            {t("conflictItem", {
              id: b.id,
              when: when.format(new Date(b.startsAt)),
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The owner's slot schedule: weekly pattern, date exceptions, blocked dates. */
export function ScheduleManager() {
  const t = useTranslations("Dashboard.schedule");
  const locale = useLocale();
  const [tab, setTab] = useState<"pattern" | "exceptions">("pattern");
  const [week, setWeek] = useState<Week | null>(null);
  const [exceptions, setExceptions] = useState<DateException[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openDay, setOpenDay] = useState<number>(WEEK_ORDER[0]);
  const [copyFrom, setCopyFrom] = useState<number | null>(null);
  const [copyTo, setCopyTo] = useState<number[]>([]);
  const [message, setMessage] = useState<Message>(null);
  const [conflict, setConflict] = useState<ConflictBooking[] | null>(null);
  const [serverProblems, setServerProblems] = useState<
    Map<string, SlotProblem>
  >(new Map());
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{
    mode: "block" | "custom";
    exception?: DateException;
  } | null>(null);

  const load = useCallback(async () => {
    const [p, e] = await Promise.all([
      call<{ slots: PatternSlot[] }>("/api/v1/staff/schedule/pattern", "GET"),
      call<{ exceptions: DateException[] }>(
        "/api/v1/staff/schedule/exceptions",
        "GET",
      ),
    ]);
    if (p.ok && p.data && e.ok && e.data) {
      setWeek(toWeek(p.data.slots));
      setExceptions(e.data.exceptions);
      setLoadFailed(false);
    } else {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    // Fetch on mount; the state update happens when the response arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loadFailed) {
    return (
      <p role="alert" className="rounded-sm bg-danger-soft p-3 text-danger">
        {t("loadFailed")}
      </p>
    );
  }
  if (!week || !exceptions) return <p className="text-muted">{t("loading")}</p>;

  const allEmpty = fromWeek(week).length === 0;

  function problemsFor(day: number): Map<number, SlotProblem> {
    const local = slotProblems(week![day] ?? []);
    for (const [key, problem] of serverProblems) {
      const [d, i] = key.split(":").map(Number);
      if (d === day && !local.has(i!)) local.set(i!, problem);
    }
    return local;
  }

  function editDay(day: number, slots: EditableSlot[]) {
    setWeek({ ...week!, [day]: slots });
    setServerProblems(new Map());
    setConflict(null);
    setMessage(null);
  }

  async function savePattern() {
    if (busy) return;
    setMessage(null);
    setConflict(null);
    const anyLocal = WEEK_ORDER.some((d) => slotProblems(week![d]!).size > 0);
    if (anyLocal) {
      setShowErrors(true);
      // Focus moves to the first offending slot once the errors render.
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>("[data-slot-error]")
          ?.closest("[role=group]")
          ?.querySelector<HTMLElement>("input")
          ?.focus(),
      );
      return;
    }
    setShowErrors(false);
    const slots = fromWeek(week!);
    setBusy(true);
    const result = await call<{ slots: PatternSlot[] }>(
      "/api/v1/staff/schedule/pattern",
      "PUT",
      { slots },
    );
    setBusy(false);
    if (result.ok && result.data) {
      setWeek(toWeek(result.data.slots));
      setServerProblems(new Map());
      setMessage({ ok: true, text: t("patternSaved") });
    } else if (result.error?.code === "SCHEDULE_CONFLICT") {
      setConflict(result.error.details?.bookings ?? []);
    } else if (result.error?.code === "VALIDATION_FAILED") {
      // Map the server's flat `slots.N.field` paths back to day and index.
      const map = new Map<string, SlotProblem>();
      for (const issue of result.error.details?.issues ?? []) {
        const n = Number(issue.path.split(".")[1]);
        const slot = slots[n];
        if (!slot) continue;
        const index = sortSlots(week![slot.weekday]!).findIndex(
          (s) => s.start === slot.start && s.end === slot.end,
        );
        map.set(`${slot.weekday}:${index}`, "overlap");
      }
      setServerProblems(map);
      setMessage({ ok: false, text: t("invalid") });
    } else {
      setMessage({ ok: false, text: t("failed") });
    }
  }

  function applyCopy() {
    if (copyFrom === null) return;
    const source = week![copyFrom]!;
    const next = { ...week! };
    for (const day of copyTo) {
      next[day] = source.map((s) => ({ ...s }));
    }
    setWeek(next);
    setCopyFrom(null);
    setCopyTo([]);
    setMessage(null);
  }

  async function removeException(e: DateException) {
    if (!window.confirm(t("confirmRemove", { date: formatDay(e.day, locale) })))
      return;
    setMessage(null);
    setConflict(null);
    const result = await call(
      `/api/v1/staff/schedule/exceptions/${e.day}`,
      "DELETE",
    );
    if (result.ok) {
      setMessage({ ok: true, text: t("exceptionRemoved") });
    } else if (result.error?.code === "SCHEDULE_CONFLICT") {
      setConflict(result.error.details?.bookings ?? []);
    } else {
      setMessage({ ok: false, text: t("failed") });
    }
    await load();
  }

  const tabClass = (active: boolean) =>
    "h-(--size-touch-dense) rounded-full px-5 text-sm font-medium " +
    (active ? "bg-primary text-primary-foreground" : "bg-surface text-muted");

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label={t("title")} className="flex gap-2">
        {(["pattern", "exceptions"] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`tab-${name}`}
            aria-selected={tab === name}
            aria-controls={`panel-${name}`}
            className={tabClass(tab === name)}
            onClick={() => {
              setTab(name);
              setMessage(null);
              setConflict(null);
            }}
          >
            {t(name === "pattern" ? "tabPattern" : "tabExceptions")}
          </button>
        ))}
      </div>

      <Notice message={message} />
      <ConflictPanel bookings={conflict} locale={locale} />

      {tab === "pattern" && (
        <section
          role="tabpanel"
          id="panel-pattern"
          aria-labelledby="tab-pattern"
          className="space-y-4"
        >
          {allEmpty && (
            <p role="status" className="rounded-sm bg-warning-soft p-3 text-sm">
              {t("emptyPattern")}
            </p>
          )}
          <div className="overflow-x-auto">
            <div className="space-y-3 md:grid md:min-w-[70rem] md:grid-cols-7 md:gap-3 md:space-y-0 xl:min-w-0">
              {WEEK_ORDER.map((day) => {
                const slots = week[day]!;
                const problems =
                  showErrors || serverProblems.size > 0
                    ? problemsFor(day)
                    : new Map<number, SlotProblem>();
                const name = weekdayName(day, locale);
                const open = openDay === day;
                return (
                  <div
                    key={day}
                    role="group"
                    aria-labelledby={`day-${day}`}
                    className={cardClass}
                  >
                    <h2 id={`day-${day}`} className="text-base font-bold">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between md:pointer-events-none"
                        aria-expanded={open}
                        aria-controls={`day-body-${day}`}
                        onClick={() => setOpenDay(open ? -1 : day)}
                      >
                        {name}
                        <span className="text-sm text-muted md:hidden">
                          {t("slotCount", { count: slots.length })}
                        </span>
                      </button>
                    </h2>
                    <div
                      id={`day-body-${day}`}
                      className={
                        (open ? "space-y-3" : "hidden") +
                        " md:block md:space-y-3"
                      }
                    >
                      {slots.length === 0 && (
                        <p className="text-sm text-muted">{t("noSlots")}</p>
                      )}
                      {slots.map((slot, i) => (
                        <SlotEditor
                          key={i}
                          slot={slot}
                          problem={problems.get(i)}
                          label={
                            isValidTime(slot.start) && isValidTime(slot.end)
                              ? `${formatTime(slot.start, locale)} – ${formatTime(slot.end, locale)}`
                              : name
                          }
                          onChange={(s) =>
                            editDay(
                              day,
                              slots.map((x, j) => (j === i ? s : x)),
                            )
                          }
                          onRemove={() =>
                            editDay(
                              day,
                              slots.filter((_, j) => j !== i),
                            )
                          }
                        />
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() =>
                            editDay(day, [...slots, nextSlot(slots)])
                          }
                        >
                          {t("addSlot")}
                        </Button>
                        {slots.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            aria-expanded={copyFrom === day}
                            onClick={() => {
                              setCopyFrom(copyFrom === day ? null : day);
                              setCopyTo([]);
                            }}
                          >
                            {t("copyTo")}
                          </Button>
                        )}
                      </div>
                      {copyFrom === day && (
                        <fieldset className="space-y-2 text-sm">
                          <legend className="text-muted">
                            {t("copyLegend", { day: name })}
                          </legend>
                          {WEEK_ORDER.filter((d) => d !== day).map((d) => (
                            <label key={d} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={copyTo.includes(d)}
                                onChange={(e) =>
                                  setCopyTo(
                                    e.target.checked
                                      ? [...copyTo, d]
                                      : copyTo.filter((x) => x !== d),
                                  )
                                }
                              />
                              {weekdayName(d, locale)}
                            </label>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-full"
                            disabled={copyTo.length === 0}
                            onClick={applyCopy}
                          >
                            {t("copyApply")}
                          </Button>
                        </fieldset>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="sticky bottom-20 flex justify-end md:static">
            <Button
              type="button"
              disabled={busy}
              onClick={savePattern}
              className="h-(--size-touch-dense) rounded-full shadow-md"
            >
              {busy ? t("saving") : t("savePattern")}
            </Button>
          </div>
        </section>
      )}

      {tab === "exceptions" && (
        <section
          role="tabpanel"
          id="panel-exceptions"
          aria-labelledby="tab-exceptions"
          className="space-y-4"
        >
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-(--size-touch-dense) rounded-full"
              onClick={() => setDialog({ mode: "block" })}
            >
              {t("blockDate")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-(--size-touch-dense) rounded-full"
              onClick={() => setDialog({ mode: "custom" })}
            >
              {t("customDate")}
            </Button>
          </div>
          {exceptions.length === 0 ? (
            <p className="text-muted">{t("noExceptions")}</p>
          ) : (
            <ul className="space-y-3">
              {exceptions.map((e) => (
                <li
                  key={e.day}
                  className={cardClass + " flex flex-wrap items-center gap-3"}
                >
                  <span className="font-bold">{formatDay(e.day, locale)}</span>
                  <span className="text-sm">
                    {e.closed
                      ? t("closed")
                      : t("custom", {
                          slots: e.slots
                            .map(
                              (s) =>
                                `${formatTime(s.start, locale)} – ${formatTime(s.end, locale)}`,
                            )
                            .join("، "),
                        })}
                  </span>
                  {e.note && (
                    <span dir="auto" className="text-sm text-muted">
                      “{e.note}”
                    </span>
                  )}
                  <div className="ms-auto flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() =>
                        setDialog({
                          mode: e.closed ? "block" : "custom",
                          exception: e,
                        })
                      }
                    >
                      {t("edit")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => removeException(e)}
                    >
                      {t("remove")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {dialog && (
        <ExceptionDialog
          mode={dialog.mode}
          existing={dialog.exception}
          pattern={week}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null);
            setMessage({ ok: true, text: t("exceptionSaved") });
            await load();
          }}
          onConflict={(bookings) => {
            setDialog(null);
            setConflict(bookings);
          }}
        />
      )}
    </div>
  );
}

/** Add or change one date: closed, or with its own slots. A modal, so focus stays inside it. */
function ExceptionDialog({
  mode,
  existing,
  pattern,
  onClose,
  onSaved,
  onConflict,
}: {
  mode: "block" | "custom";
  existing?: DateException;
  pattern: Week;
  onClose: () => void;
  onSaved: () => void;
  onConflict: (bookings: ConflictBooking[]) => void;
}) {
  const t = useTranslations("Dashboard.schedule");
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [day, setDay] = useState(existing?.day ?? "");
  const [closed, setClosed] = useState(
    existing ? existing.closed : mode === "block",
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [slots, setSlots] = useState<EditableSlot[]>(existing?.slots ?? []);
  const [edited, setEdited] = useState(Boolean(existing));
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  /** "Custom slots" starts from the weekday's pattern, until the owner edits. */
  function pickDay(value: string) {
    setDay(value);
    if (!edited && value) {
      setSlots((pattern[weekdayOfDay(value)] ?? []).map((s) => ({ ...s })));
    }
  }

  const problems = slotProblems(closed ? [] : slots);

  async function save() {
    if (busy) return;
    setError(null);
    if (!day || day < todayInCairo()) {
      setShowErrors(true);
      setError(t("dateInvalid"));
      return;
    }
    if (!closed && (slots.length === 0 || problems.size > 0)) {
      setShowErrors(true);
      setError(slots.length === 0 ? t("slotsRequired") : t("invalid"));
      return;
    }
    setBusy(true);
    const result = await call(
      `/api/v1/staff/schedule/exceptions/${day}`,
      "PUT",
      {
        date: day,
        closed,
        note: note.trim() || null,
        slots: closed ? [] : slots,
      },
    );
    setBusy(false);
    if (result.ok) onSaved();
    else if (result.error?.code === "SCHEDULE_CONFLICT") {
      onConflict(result.error.details?.bookings ?? []);
    } else if (result.error?.code === "VALIDATION_FAILED") {
      setError(t("invalid"));
    } else setError(t("failed"));
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="exception-title"
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg bg-surface p-5 text-foreground shadow-md backdrop:bg-black/50"
    >
      <div className="space-y-4">
        <h2 id="exception-title" className="text-xl font-bold">
          {closed ? t("dialogBlock") : t("dialogCustom")}
        </h2>
        <label className="block space-y-1 text-sm">
          {t("date")}
          <input
            type="date"
            dir="ltr"
            value={day}
            min={todayInCairo()}
            disabled={Boolean(existing)}
            onChange={(e) => pickDay(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={closed}
            onChange={(e) => setClosed(e.target.checked)}
          />
          {t("closedToggle")}
        </label>
        <label className="block space-y-1 text-sm">
          {t("note")}
          <input
            dir="auto"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
        </label>
        {!closed && (
          <div className="space-y-3">
            {slots.map((slot, i) => (
              <SlotEditor
                key={i}
                slot={slot}
                problem={showErrors ? problems.get(i) : undefined}
                label={
                  isValidTime(slot.start) && isValidTime(slot.end)
                    ? `${formatTime(slot.start, locale)} – ${formatTime(slot.end, locale)}`
                    : t("slotN", { n: i + 1 })
                }
                onChange={(s) => {
                  setEdited(true);
                  setSlots(slots.map((x, j) => (j === i ? s : x)));
                }}
                onRemove={() => {
                  setEdited(true);
                  setSlots(slots.filter((_, j) => j !== i));
                }}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setEdited(true);
                setSlots([...slots, nextSlot(slots)]);
              }}
            >
              {t("addSlot")}
            </Button>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-sm bg-danger-soft p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => ref.current?.close()}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={busy}
            className="rounded-full"
            onClick={save}
          >
            {busy ? t("saving") : t("saveException")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
