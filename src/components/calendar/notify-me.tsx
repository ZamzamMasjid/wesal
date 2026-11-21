"use client";

import { BellRing } from "lucide-react";import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { CodeStep } from "@/components/booking/code-step";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSlotAlert } from "@/lib/alerts-api";
import { longDayLabel } from "@/lib/calendar-grid";
import { formatTime } from "@/lib/slot-time";

// "Notify me" on a taken slot (docs/design/views/slot-alert-signup.md): the
// visitor enters a phone, proves it with the same code step the booking form
// uses, and subscribes. It is deliberately secondary in weight and says plainly
// that it reserves nothing.

type Step = "phone" | "code" | "done";

export interface NotifyMeProps {
  /** `YYYY-MM-DD`, Africa/Cairo. */
  day: string;
  /** `HH:MM`, Africa/Cairo. */
  start: string;
  /** `HH:MM`, Africa/Cairo. */
  end: string;
  /** The slot's public state label, shown in the dialog's summary. */
  stateLabel: string;
  /** This visit already subscribed to the slot; show the confirmation label. */
  subscribed: boolean;
  onSubscribed: () => void;
}

type ErrorKey = "limitReached" | "slotUnavailable" | "notVerified" | "failed";

function errorText(code: string | undefined): ErrorKey {
  switch (code) {
    case "ALERT_LIMIT_REACHED":
      return "limitReached";
    case "SLOT_UNAVAILABLE":
      return "slotUnavailable";
    case "PHONE_NOT_VERIFIED":
      return "notVerified";
    default:
      return "failed";
  }
}

export function NotifyMe({
  day,
  start,
  end,
  stateLabel,
  subscribed,
  onSubscribed,
}: NotifyMeProps) {
  const t = useTranslations("Alerts");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setStep("phone");
    setPhone("");
    setVerifiedPhone("");
    setNotice(null);
    setPending(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function onSubmitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phone.trim() === "") {
      setNotice(t("phoneRequired"));
      return;
    }
    setNotice(null);
    setStep("code");
  }

  async function onVerified(result: { token: string; phone: string }) {
    setPending(true);
    setNotice(null);
    const answer = await createSlotAlert({
      day,
      start,
      end,
      phone: result.phone,
      token: result.token,
      locale,
    });
    setPending(false);
    if (answer.ok) {
      setVerifiedPhone(result.phone);
      setStep("done");
      onSubscribed();
      return;
    }
    setNotice(t(errorText(answer.error?.code)));
    setStep("phone");
  }

  const time = formatTime(start, locale);

  if (subscribed && !open) {
    return (
      <span className="inline-flex min-h-(--size-touch) w-full items-center justify-center gap-2 rounded-full bg-fill px-5 text-sm font-medium text-muted">
        <BellRing aria-hidden="true" className="size-4" strokeWidth={1.75} />
        {t("subscribedTitle")}
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t("notifySlot", { time })}
          className="inline-flex min-h-(--size-touch) w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 font-semibold text-fg transition-colors hover:bg-fill motion-reduce:transition-none"
        >
          <BellRing aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t("notify")}
        </button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")}>
        {step === "done" ? (
          <div className="space-y-4">
            <DialogTitle>{t("subscribedTitle")}</DialogTitle>
            <p className="text-muted" role="status">
              {t("subscribedBody", { phone: verifiedPhone })}
            </p>
            <p className="text-sm text-muted">{t("reservesNothing")}</p>
            <Button
              type="button"
              className="h-(--size-touch) w-full rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
              onClick={() => onOpenChange(false)}
            >
              {t("backToCalendar")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>

            <div className="rounded-lg bg-fill px-4 py-3 text-sm">
              <p className="font-semibold">{longDayLabel(day, locale)}</p>
              <p className="text-muted">
                <bdi className="tabular-nums">{formatTime(start, locale)}</bdi>
                <span aria-hidden="true"> – </span>
                <bdi className="tabular-nums">{formatTime(end, locale)}</bdi>
                {" · "}
                {stateLabel}
              </p>
            </div>

            {notice && (
              <p
                role="alert"
                className="rounded-sm bg-danger-soft p-3 text-sm text-danger"
              >
                {notice}
              </p>
            )}

            {step === "phone" ? (
              <form noValidate onSubmit={onSubmitPhone} className="space-y-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">{t("phone")}</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    placeholder="01xxxxxxxxx"
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setNotice(null);
                    }}
                    className="h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-4 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  />
                  <span className="block text-muted">{t("phoneHint")}</span>
                </label>
                <Button
                  type="submit"
                  className="h-(--size-touch) w-full rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
                >
                  {t("sendCode")}
                </Button>
              </form>
            ) : (
              <CodeStep
                phone={phone.trim()}
                onVerified={(result) => void onVerified(result)}
                onChangeNumber={() => {
                  setNotice(null);
                  setStep("phone");
                }}
              />
            )}

            {step === "phone" && (
              <p className="text-sm text-muted">{t("reservesNothing")}</p>
            )}
            {step === "code" && pending && (
              <p role="status" className="text-sm text-muted">
                {t("subscribing")}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
