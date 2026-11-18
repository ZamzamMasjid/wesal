import { createHmac, timingSafeEqual } from "node:crypto";

import { isE164, normalizePhone } from "./phone";

// A verified-phone token proves, for a short time, that this browser checked a
// code for one number (docs/architecture/auth.md). It is signed, not stored:
// the create-hold endpoint in phase 3 checks it and the phone it was issued for.

const VERSION = "v1";

/** How long a successful check can be used to create a hold. */
export const VERIFIED_PHONE_TOKEN_MINUTES = 10;

export interface VerifiedPhoneToken {
  phone: string;
  expiresAt: Date;
}

interface Payload {
  phone: string;
  /** Expiry as Unix seconds. */
  exp: number;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${VERSION}.${body}`)
    .digest("base64url");
}

/** Issues a token bound to `phone`, valid for `ttlMinutes` from `now`. */
export function issueVerifiedPhoneToken(
  phone: string,
  now: Date,
  secret: string,
  ttlMinutes = VERIFIED_PHONE_TOKEN_MINUTES,
): { token: string; expiresAt: Date } {
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
  const payload: Payload = {
    phone: normalizePhone(phone),
    exp: Math.floor(expiresAt.getTime() / 1000),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return { token: `${VERSION}.${body}.${sign(body, secret)}`, expiresAt };
}

/**
 * Reads a token issued by `issueVerifiedPhoneToken`. Returns null for a token
 * that is malformed, signed with another secret, or expired.
 */
export function readVerifiedPhoneToken(
  token: string,
  now: Date,
  secret: string,
): VerifiedPhoneToken | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  const [, body, signature] = parts;
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body, secret), "utf8");
  const received = Buffer.from(signature, "utf8");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { phone, exp } = parsed as Partial<Payload>;
  if (
    typeof phone !== "string" ||
    !isE164(normalizePhone(phone)) ||
    typeof exp !== "number" ||
    !Number.isInteger(exp)
  ) {
    return null;
  }

  const expiresAt = new Date(exp * 1000);
  if (expiresAt.getTime() <= now.getTime()) return null;
  return { phone: normalizePhone(phone), expiresAt };
}

/**
 * Whether `token` is valid and was issued for `phone`. The create-hold endpoint
 * uses this; a token for a different number is rejected.
 */
export function verifyVerifiedPhoneToken(
  token: string,
  phone: string,
  now: Date,
  secret: string,
): boolean {
  const payload = readVerifiedPhoneToken(token, now, secret);
  return payload !== null && payload.phone === normalizePhone(phone);
}
