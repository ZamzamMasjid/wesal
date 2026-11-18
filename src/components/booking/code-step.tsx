"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { Button } from "@/components/ui/button";
import {
  checkVerificationCode,
  requestVerificationCode,
  type ApiEnvelope,
  type CodeCheckResult,
  type CodeRequestResult,
} from "@/lib/verification-api";
import {
  dialable,
  venueContact,
  whatsappUrl,
  type VenueContact,
} from "@/lib/venue-contact";

import {
  CODE_LENGTH,
  digitsOnly,
  formatCountdown,
  secondsUntil,
} from "./code-input";

// Step 2 of the booking form (docs/design/views/booking-form.md): the customer
// enters the six-digit code. The code is requested when the step opens and on
// resend; a delivery failure replaces the input with the venue's contact
// details, because no hold can be created without a code (ADR-016).

type Phase = "sending" | "ready" | "checking" | "delivery-failed";

type Problem =
  | { kind: "invalid"; attemptsLeft: number }
  | { kind: "expired" }
  | { kind: "tooMany" }
  | { kind: "rateLimited"; seconds: number }
  | { kind: "network" }
  | null;

export interface CodeStepProps {
  /** E.164, as submitted in step 1. */
  phone: string;
  onVerified: (result: { token: string; phone: string }) => void;
  onChangeNumber: () => void;
  /** Test seams; the defaults call the public API. */
  requestCode?: (phone: string) => Promise<ApiEnvelope<CodeRequestResult>>;
  checkCode?: (
    phone: string,
    code: string,
  ) => Promise<ApiEnvelope<CodeCheckResult>>;
}

const boxClass =
  "flex h-14 w-12 items-center justify-center rounded-md border border-border bg-surface font-mono text-3xl text-fg";

function detailString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function CodeStep({
  phone,
  onVerified,
  onChangeNumber,
  requestCode,
  checkCode,
}: CodeStepProps) {
  const t = useTranslations("Verification");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const ids = { heading: useId(), input: useId(), error: useId() };
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const checking = useRef(false);

  const [phase, setPhase] = useState<Phase>("sending");
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<Problem>(null);
  const [resendAt, setResendAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [shake, setShake] = useState(false);
  const [contact, setContact] = useState<VenueContact>(venueContact);

  const send = useCallback(
    (target: string) =>
      requestCode
        ? requestCode(target)
        : requestVerificationCode(target, locale),
    [locale, requestCode],
  );
  const check = useCallback(
    (target: string, value: string) =>
      checkCode
        ? checkCode(target, value)
        : checkVerificationCode(target, value),
    [checkCode],
  );

  const start = useCallback(async () => {
    setPhase("sending");
    setProblem(null);
    setCode("");
    setShake(false);
    const result = await send(phone);
    setNowMs(Date.now());

    if (result.ok && result.data) {
      setResendAt(result.data.resendAt);
      setPhase("ready");
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    const error = result.error;
    if (error?.code === "CODE_DELIVERY_FAILED") {
      setContact({
        phone: detailString(error.details?.phone) ?? venueContact.phone,
        whatsapp:
          detailString(error.details?.whatsapp) ?? venueContact.whatsapp,
      });
      setPhase("delivery-failed");
      return;
    }

    if (error?.code === "RATE_LIMITED") {
      const seconds = Number(error.details?.retryAfterSeconds ?? 0);
      if (seconds > 0) {
        setResendAt(new Date(Date.now() + seconds * 1000).toISOString());
      }
      setProblem({ kind: "rateLimited", seconds });
    } else {
      setProblem({ kind: "network" });
    }
    setPhase("ready");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [phone, send]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // The request is the point of opening this step.
    void start();
  }, [start]);

  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const resendIn = resendAt ? secondsUntil(resendAt, nowMs) : 0;
  const busy = phase === "sending" || phase === "checking";
  const disabled = busy || phase === "delivery-failed";

  const submit = useCallback(
    async (value: string) => {
      if (checking.current) return;
      checking.current = true;
      setPhase("checking");
      setProblem(null);
      const result = await check(phone, value);

      if (result.ok && result.data) {
        onVerified({ token: result.data.token, phone: result.data.phone });
        return;
      }

      checking.current = false;
      setCode("");
      setPhase("ready");
      const error = result.error;
      if (error?.code === "CODE_INVALID") {
        setProblem({
          kind: "invalid",
          attemptsLeft: Number(error.details?.attemptsLeft ?? 0),
        });
        setShake(true);
      } else if (error?.code === "CODE_EXPIRED") {
        setProblem({ kind: "expired" });
      } else if (error?.code === "TOO_MANY_ATTEMPTS") {
        setProblem({ kind: "tooMany" });
      } else if (error?.code === "RATE_LIMITED") {
        const seconds = Number(error.details?.retryAfterSeconds ?? 0);
        setProblem({ kind: "rateLimited", seconds });
      } else {
        setProblem({ kind: "network" });
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [check, onVerified, phone],
  );

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const next = digitsOnly(event.target.value);
    setCode(next);
    if (problem) setProblem(null);
    if (next.length === CODE_LENGTH) void submit(next);
  }

  function problemText(value: Problem): string {
    if (!value) return "";
    switch (value.kind) {
      case "invalid":
        return `${t("errorInvalid")} ${t("attemptsLeft", {
          count: value.attemptsLeft,
        })}`;
      case "expired":
        return t("errorExpired");
      case "tooMany":
        return t("errorTooMany");
      case "rateLimited":
        return t("errorRateLimited", { seconds: value.seconds });
      case "network":
        return t("errorNetwork");
    }
  }

  if (phase === "delivery-failed") {
    return (
      <section
        aria-labelledby={ids.heading}
        className="space-y-4 rounded-lg bg-surface p-6 shadow-md"
      >
        <h2 id={ids.heading} className="text-2xl font-bold">
          {t("deliveryTitle")}
        </h2>
        <p className="text-muted">{t("deliveryBody")}</p>
        <div className="flex flex-wrap gap-2">
          {contact.phone && (
            <Button asChild variant="outline" className="rounded-full">
              <a href={`tel:${dialable(contact.phone)}`}>
                {t("call")}: <bdi dir="ltr">{contact.phone}</bdi>
              </a>
            </Button>
          )}
          {contact.whatsapp && (
            <Button asChild className="rounded-full">
              <a
                href={whatsappUrl(contact.whatsapp)}
                target="_blank"
                rel="noreferrer"
              >
                {t("whatsapp")}
              </a>
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => void start()}
          >
            {t("retry")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={onChangeNumber}
          >
            {t("changeNumber")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={ids.heading} className="space-y-4">
      <h2 id={ids.heading} className="text-2xl font-bold">
        {t("codeLabel")}
      </h2>
      <p className="text-sm text-muted">
        {t("sentTo", { phone })}{" "}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm"
          onClick={onChangeNumber}
        >
          {t("changeNumber")}
        </Button>
      </p>

      <div className="relative w-fit">
        <label htmlFor={ids.input} className="sr-only">
          {t("codeLabel")}
        </label>
        <input
          id={ids.input}
          ref={inputRef}
          value={code}
          onChange={onChange}
          disabled={disabled}
          dir="ltr"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH}
          aria-invalid={problem !== null}
          aria-describedby={problem ? ids.error : undefined}
          className="absolute inset-0 z-10 size-full cursor-text rounded-md bg-transparent text-transparent opacity-0 outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        <div
          aria-hidden="true"
          onAnimationEnd={() => setShake(false)}
          className={`flex gap-2 ${shake ? "animate-[shake_0.3s_ease-in-out]" : ""} ${
            disabled ? "opacity-50" : ""
          }`}
        >
          {Array.from({ length: CODE_LENGTH }, (_, index) => (
            <span key={index} className={boxClass}>
              {code[index] ?? ""}
            </span>
          ))}
        </div>
        {busy && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="size-6 animate-spin rounded-full border-2 border-border border-t-brand" />
          </span>
        )}
      </div>

      {busy && (
        <p role="status" className="text-sm text-muted">
          {phase === "sending" ? t("sending") : t("checking")}
        </p>
      )}

      {problem && (
        <p
          id={ids.error}
          role="alert"
          className="rounded-sm bg-danger-soft p-3 text-sm text-danger"
        >
          {problemText(problem)}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        onClick={() => void start()}
        disabled={resendIn > 0 || busy}
      >
        {resendIn > 0
          ? t("resendIn", { time: formatCountdown(resendIn) })
          : t("resend")}
      </Button>
    </section>
  );
}
