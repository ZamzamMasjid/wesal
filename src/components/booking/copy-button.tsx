"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

// A one-tap copy button for a payment number, an address or a booking ID
// (docs/design/views/booking-status.md). The button names what it copies, and
// the result is confirmed inline, not only by a color change.

type Result = "idle" | "copied" | "failed";

function legacyCopy(value: string): boolean {
  if (typeof document === "undefined") return false;
  if (typeof document.execCommand !== "function") return false;
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  field.remove();
  return ok;
}

export function CopyButton({
  value,
  label,
  className = "",
}: {
  value: string;
  /** What is being copied, e.g. "Vodafone Cash number". */
  label: string;
  className?: string;
}) {
  const t = useTranslations("BookingPage");
  const [result, setResult] = useState<Result>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      } else {
        ok = legacyCopy(value);
      }
    } catch {
      ok = legacyCopy(value);
    }

    setResult(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult("idle"), 2000);
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t("copy", { label })}
        className="inline-flex size-(--size-touch) items-center justify-center rounded-full bg-fill text-fg transition-colors hover:bg-border focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
      >
        {result === "copied" ? (
          <Check aria-hidden="true" className="size-5" strokeWidth={1.75} />
        ) : (
          <Copy aria-hidden="true" className="size-5" strokeWidth={1.75} />
        )}
      </button>
      <span
        aria-live="polite"
        className={`text-xs ${
          result === "failed" ? "text-danger" : "text-muted"
        }`}
      >
        {result === "copied"
          ? t("copied")
          : result === "failed"
            ? t("copyFailed")
            : ""}
      </span>
    </span>
  );
}
