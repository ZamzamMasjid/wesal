"use client";

import { AlertTriangle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { CodeStep } from "@/components/booking/code-step";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { createHold, type HoldCreated } from "@/lib/booking-api";
import { cairoParts } from "@/lib/cairo-time";
import { longDayLabel } from "@/lib/calendar-grid";
import { formatTime } from "@/lib/slot-time";

// Step 1 and the result of the booking form (docs/design/views/booking-form.md).
// The slot is chosen on the calendar and arrives in the URL; this page asks for
// the occasion, name and phone, then hands over to the verification code step,
// which creates the hold. A slot taken by someone else replaces the form with
// the conflict panel, because retrying the same slot cannot help.

export interface BookingOccasion {
  id: number;
  nameAr: string;
  nameEn: string;
  priceEgp: number;
}

export interface BookingFormProps {
  /** `YYYY-MM-DD`, Africa/Cairo. */
  day: string;
  /** `HH:MM`, Africa/Cairo. */
  start: string;
  /** `HH:MM`, Africa/Cairo. */
  end: string;
  occasions: BookingOccasion[];
  depositPercent: number;
  holdMinutes: number;
}

type Step = "details" | "code" | "held";

type Blocked = { code: string; bookingId?: string };

type FieldErrors = {
  name?: string;
  phone?: string;
  occasion?: string;
};

const inputClass =
  "h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-4 outline-none focus-visible:ring-2 focus-visible:ring-focus aria-invalid:border-danger";

export function BookingForm({
  day,
  start,
  end,
  occasions,
  depositPercent,
  holdMinutes,
}: BookingFormProps) {
  const t = useTranslations("Booking");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const ids = {
    summary: useId(),
    name: useId(),
    phone: useId(),
    occasion: useId(),
    deposit: useId(),
  };
  const detailsHeading = useRef<HTMLHeadingElement>(null);
  const heldHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef<Step>("details");

  const [step, setStep] = useState<Step>("details");
  const [occasionId, setOccasionId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    name: string;
    phone: string;
    occasionId: number;
  } | null>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [pending, setPending] = useState(false);
  const [held, setHeld] = useState<HoldCreated | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState("");

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    if (step === "details") detailsHeading.current?.focus();
    if (step === "held") heldHeading.current?.focus();
  }, [step]);

  const chosen = occasions.find((o) => o.id === occasionId);
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (name.trim() === "") found.name = t("errorName");
    if (phone.trim() === "") found.phone = t("errorPhone");
    if (occasionId === null) found.occasion = t("errorOccasion");
    return found;
  }

  function onSubmitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || occasionId === null) return;
    setSubmitted({ name: name.trim(), phone: phone.trim(), occasionId });
    setStep("code");
  }

  function messageFor(code: string, bookingId?: string): string {
    switch (code) {
      case "SLOT_TAKEN":
        return t("errorSlotTaken");
      case "SLOT_UNAVAILABLE":
        return t("errorSlotUnavailable");
      case "PHONE_HOLD_EXISTS":
        return t("errorPhoneHold", { bookingId: bookingId ?? "" });
      case "PHONE_NOT_VERIFIED":
        return t("errorNotVerified");
      case "OCCASION_UNAVAILABLE":
        return t("errorOccasionUnavailable");
      default:
        return t("errorGeneric");
    }
  }

  async function onVerified(token: string, verified: string) {
    if (!submitted || pending) return;
    setPending(true);
    setNotice(null);
    const result = await createHold({
      day,
      start,
      end,
      occasionId: submitted.occasionId,
      name: submitted.name,
      phone: submitted.phone,
      token,
      locale,
    });
    setPending(false);

    if (result.ok && result.data) {
      setVerifiedPhone(verified);
      setHeld(result.data);
      setStep("held");
      return;
    }

    const error = result.error;
    const code = error?.code ?? "INTERNAL";
    if (
      code === "SLOT_TAKEN" ||
      code === "SLOT_UNAVAILABLE" ||
      code === "PHONE_HOLD_EXISTS"
    ) {
      const bookingId =
        typeof error?.details?.bookingId === "string"
          ? error.details.bookingId
          : undefined;
      setBlocked({ code, bookingId });
      return;
    }
    setNotice(messageFor(code));
    setStep("details");
  }

  if (blocked) {
    return (
      <section
        role="alert"
        className="space-y-4 rounded-lg bg-surface p-6 shadow-md"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning"
        >
          <AlertTriangle className="size-6" strokeWidth={1.75} />
        </span>
        <h2 className="text-2xl font-bold">{t("conflictTitle")}</h2>
        <p className="text-muted">
          {messageFor(blocked.code, blocked.bookingId)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-full">
            <Link href={`/calendar?day=${day}`}>{t("chooseAnother")}</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setBlocked(null)}
          >
            {t("book")}
          </Button>
        </div>
      </section>
    );
  }

  if (step === "held" && held) {
    const deadline = cairoParts(new Date(held.deadlineAt));
    return (
      <section className="space-y-4 rounded-lg bg-surface p-6 shadow-md">
        <h2
          ref={heldHeading}
          tabIndex={-1}
          className="text-2xl font-bold outline-none"
        >
          {t("heldTitle")}
        </h2>
        <p className="text-muted">
          {t("heldBody", { phone: verifiedPhone || phone })}
        </p>
        <div className="space-y-1 text-sm">
          <p>{t("heldBookingId", { bookingId: held.bookingId })}</p>
          <p>
            {t("heldDeadline", { time: formatTime(deadline.time, locale) })}{" "}
            {longDayLabel(day, locale)}
          </p>
          <p>{t("heldDeposit", { amount: money.format(held.depositEgp) })}</p>
        </div>
        <Button asChild className="h-(--size-touch) w-full rounded-full">
          <Link href={`/booking/${encodeURIComponent(held.linkToken)}`}>
            {t("heldOpen")}
          </Link>
        </Button>
      </section>
    );
  }

  if (step === "code" && submitted) {
    return (
      <section className="space-y-5">
        <SlotSummary day={day} start={start} end={end} locale={locale} />
        {pending && (
          <p role="status" className="text-sm text-muted">
            {t("submitting")}
          </p>
        )}
        <CodeStep
          phone={submitted.phone}
          onVerified={(result) => void onVerified(result.token, result.phone)}
          onChangeNumber={() => {
            setNotice(null);
            setStep("details");
          }}
        />
      </section>
    );
  }

  return (
    <form noValidate onSubmit={onSubmitDetails} className="space-y-5">
      <SlotSummary day={day} start={start} end={end} locale={locale} />

      {notice && (
        <p
          role="alert"
          className="rounded-sm bg-danger-soft p-3 text-sm text-danger"
        >
          {notice}
        </p>
      )}

      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm text-danger">
          {t("errorSummary")}
        </p>
      )}

      <section
        aria-labelledby={ids.summary}
        className="space-y-4 rounded-lg bg-surface p-6 shadow-md"
      >
        <h2
          id={ids.summary}
          ref={detailsHeading}
          tabIndex={-1}
          className="text-2xl font-bold outline-none"
        >
          {t("detailsTitle")}
        </h2>

        <fieldset
          aria-describedby={
            errors.occasion ? `${ids.occasion}-error` : undefined
          }
          className="space-y-2"
        >
          <legend className="mb-2 font-semibold">{t("occasionLegend")}</legend>
          {occasions.map((occasion) => {
            const label = locale === "ar" ? occasion.nameAr : occasion.nameEn;
            return (
              <label
                key={occasion.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 has-checked:border-brand has-checked:bg-accent-soft"
              >
                <input
                  type="radio"
                  name="occasion"
                  value={occasion.id}
                  checked={occasionId === occasion.id}
                  onChange={() => {
                    setOccasionId(occasion.id);
                    setErrors((current) => ({
                      ...current,
                      occasion: undefined,
                    }));
                  }}
                  className="size-5 accent-brand"
                />
                <span className="flex-1">{label}</span>
                <span className="tabular-nums text-muted">
                  {money.format(occasion.priceEgp)}
                </span>
              </label>
            );
          })}
          {errors.occasion && (
            <p id={`${ids.occasion}-error`} className="text-sm text-danger">
              {errors.occasion}
            </p>
          )}
        </fieldset>

        <p
          id={ids.deposit}
          className="flex items-baseline justify-between rounded-sm bg-fill px-4 py-3 text-sm"
        >
          <span>{t("depositLabel", { percent: depositPercent })}</span>
          <span className="text-base font-semibold tabular-nums">
            {chosen
              ? money.format(
                  Math.round((chosen.priceEgp * depositPercent) / 100),
                )
              : "—"}
          </span>
        </p>
        {!chosen && <p className="text-sm text-muted">{t("chooseOccasion")}</p>}

        <div className="grid gap-4">
          <label htmlFor={ids.name} className="space-y-1 text-sm">
            <span className="font-medium">{t("name")}</span>
            <input
              id={ids.name}
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${ids.name}-error` : undefined}
              className={inputClass}
            />
            {errors.name && (
              <span id={`${ids.name}-error`} className="block text-danger">
                {errors.name}
              </span>
            )}
          </label>

          <label htmlFor={ids.phone} className="space-y-1 text-sm">
            <span className="font-medium">{t("phone")}</span>
            <input
              id={ids.phone}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder="01xxxxxxxxx"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setErrors((current) => ({ ...current, phone: undefined }));
              }}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={
                errors.phone ? `${ids.phone}-error` : `${ids.phone}-hint`
              }
              className={inputClass}
            />
            {errors.phone ? (
              <span id={`${ids.phone}-error`} className="block text-danger">
                {errors.phone}
              </span>
            ) : (
              <span id={`${ids.phone}-hint`} className="block text-muted">
                {t("phoneHint")}
              </span>
            )}
          </label>
        </div>

        <section
          aria-labelledby={`${ids.summary}-next`}
          className="space-y-1 text-sm"
        >
          <h3 id={`${ids.summary}-next`} className="font-semibold">
            {t("whatNextTitle")}
          </h3>
          <ol className="list-inside list-decimal space-y-1 text-muted">
            <li>{t("whatNext1")}</li>
            <li>{t("whatNext2", { minutes: holdMinutes })}</li>
            <li>{t("whatNext3")}</li>
          </ol>
        </section>

        <Button
          type="submit"
          className="h-(--size-touch) w-full rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
        >
          {t("book")}
        </Button>
      </section>
    </form>
  );
}

function SlotSummary({
  day,
  start,
  end,
  locale,
}: {
  day: string;
  start: string;
  end: string;
  locale: "ar" | "en";
}) {
  const t = useTranslations("Booking");

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-5 py-4 shadow-md">
      <div>
        <p className="font-semibold">{longDayLabel(day, locale)}</p>
        <p className="text-sm text-muted tabular-nums">
          <bdi>{formatTime(start, locale)}</bdi>
          <span aria-hidden="true"> – </span>
          <bdi>{formatTime(end, locale)}</bdi>
        </p>
      </div>
      <Button asChild variant="ghost" className="rounded-full">
        <Link href={`/calendar?day=${day}`}>{t("back")}</Link>
      </Button>
    </div>
  );
}
