import { latinDigits } from "@/lib/digits";

// Small pure pieces of the code step. Kept apart from the component so the
// digit handling and the countdown can be tested without a DOM.

export const CODE_LENGTH = 6;

/**
 * Digits only, capped at the code length: a paste fills the whole field.
 * Arabic-Indic digits typed on an Arabic keyboard count as digits.
 */
export function digitsOnly(value: string): string {
  return latinDigits(value).replace(/\D/g, "").slice(0, CODE_LENGTH);
}

/** "0:45", "1:05" — Latin digits in both languages, like the code itself. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Whole seconds left until `iso`, never negative. */
export function secondsUntil(iso: string, nowMs: number): number {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.ceil((target - nowMs) / 1000));
}
