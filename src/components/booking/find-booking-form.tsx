"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { lookupBooking, normalizeBookingId } from "@/lib/booking-read-api";

// Find my booking (docs/features/booking-page): the customer types the short
// booking ID from their message and is taken to their private page. A wrong and
// a nonexistent ID get the same answer, and the server rate-limits the lookups;
// this form only turns the code into the link.

const inputClass =
  "h-(--size-touch) w-full rounded-full border border-border bg-surface px-4 font-mono text-fg outline-none focus-visible:ring-2 focus-visible:ring-focus";

type Problem =
  | { kind: "not-found" }
  | { kind: "rate-limited"; seconds: number }
  | { kind: "failed" }
  | null;

export function FindBookingForm() {
  const t = useTranslations("BookingPage.find");
  const router = useRouter();
  const ids = { input: useId(), hint: useId(), error: useId() };
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const bookingId = normalizeBookingId(value);
    if (bookingId === "") {
      setProblem({ kind: "not-found" });
      return;
    }

    setPending(true);
    setProblem(null);
    const result = await lookupBooking(bookingId);
    setPending(false);

    if (result.ok && result.data) {
      router.push(`/booking/${encodeURIComponent(result.data.token)}`);
      return;
    }

    if (result.error?.code === "NOT_FOUND") {
      setProblem({ kind: "not-found" });
      return;
    }
    if (result.error?.code === "RATE_LIMITED") {
      const value = result.error.details?.retryAfterSeconds;
      setProblem({
        kind: "rate-limited",
        seconds: typeof value === "number" ? value : 60,
      });
      return;
    }
    setProblem({ kind: "failed" });
  }

  const message =
    problem?.kind === "not-found"
      ? t("notFound")
      : problem?.kind === "rate-limited"
        ? t("rateLimited", { seconds: problem.seconds })
        : problem?.kind === "failed"
          ? t("failed")
          : "";

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1 text-sm">
        <label htmlFor={ids.input} className="font-medium">
          {t("label")}
        </label>
        <input
          id={ids.input}
          name="bookingId"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setProblem(null);
          }}
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t("placeholder")}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? ids.error : ids.hint}
          className={inputClass}
        />
        {problem ? (
          <p id={ids.error} role="alert" className="text-danger">
            {message}
          </p>
        ) : (
          <p id={ids.hint} className="text-muted">
            {t("hint")}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="h-(--size-touch) w-full rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
      >
        <Search aria-hidden="true" className="size-4" strokeWidth={1.75} />
        {pending ? t("submitting") : t("submit")}
      </Button>

      <p aria-live="polite" className="sr-only">
        {pending ? t("submitting") : ""}
      </p>
    </form>
  );
}
