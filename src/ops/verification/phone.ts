import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { latinDigits } from "@/lib/digits";

// Phone numbers and one-time codes (docs/features/phone-verification). Codes are
// never stored in clear text: the table holds an HMAC over the phone and the
// code, so a leaked table cannot be used to guess a live code. The HMAC key is
// the server secret, not a per-row salt, because a six-digit code has too little
// entropy to resist an offline search on its own.

/** A six-digit code, as the customer types it. */
export const CODE_DIGITS = 6;

const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Accepts what people actually type: Arabic-Indic digits become Latin ones;
 * spaces, dashes, dots and brackets are removed; `00` becomes `+`; an Egyptian
 * local number (`01xxxxxxxxx`) gets the `+20` country code. Anything else is
 * left for validation to reject.
 */
export function normalizePhone(raw: string): string {
  let value = latinDigits(raw)
    .trim()
    .replace(/[\s\-().]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (/^01\d{9}$/.test(value)) value = `+20${value.slice(1)}`;
  return value;
}

/** Whether `raw` is a deliverable international number (E.164). */
export function isE164(raw: string): boolean {
  return E164.test(raw);
}

/** A fresh code, uniformly random and zero-padded to six digits. */
export function generateCode(): string {
  return randomInt(0, 10 ** CODE_DIGITS)
    .toString()
    .padStart(CODE_DIGITS, "0");
}

function digest(phone: string, code: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest();
}

/** The value stored in `phone_verification.code_hash`. */
export function hashCode(phone: string, code: string, secret: string): string {
  return digest(phone, code, secret).toString("hex");
}

/** Compares in constant time; a malformed stored hash never matches. */
export function codeMatches(
  storedHash: string,
  phone: string,
  code: string,
  secret: string,
): boolean {
  const expected = digest(phone, code, secret);
  const received = Buffer.from(storedHash, "hex");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
