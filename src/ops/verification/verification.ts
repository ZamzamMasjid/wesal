import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { phoneVerification } from "@/db/schema";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { venueContact, type VenueContact } from "@/lib/venue-contact";
import { verificationSecret } from "@/lib/verification-secret";
import { getSender } from "@/messaging/config";
import { MessageDeliveryError, sendInline } from "@/messaging/outbox";
import type { Channel, MessageSender } from "@/messaging/sender";

import {
  CODE_DIGITS,
  codeMatches,
  generateCode,
  hashCode,
  isE164,
  normalizePhone,
} from "./phone";
import { issueVerifiedPhoneToken, VERIFIED_PHONE_TOKEN_MINUTES } from "./token";

// Phone verification (docs/features/phone-verification): a customer proves they
// control a number before a slot is held for them. The code is sent inline
// because the customer is waiting (ADR-011); if neither channel delivers, the
// request fails and no hold can be created (ADR-016).

/** How long a code works. */
export const CODE_TTL_MINUTES = 5;
/** Wrong checks before a code stops working. */
export const MAX_CODE_ATTEMPTS = 5;
/** Wait between requests for the same number. */
export const RESEND_DELAY_SECONDS = 60;
/** Requests allowed per number per hour. */
export const PHONE_REQUESTS_PER_HOUR = 5;
/** Requests allowed per IP address per hour. */
export const IP_REQUESTS_PER_HOUR = 20;

const RESEND_RULE = { limit: 1, windowSeconds: RESEND_DELAY_SECONDS } as const;
const PHONE_RULE = {
  limit: PHONE_REQUESTS_PER_HOUR,
  windowSeconds: 3600,
} as const;
const IP_RULE = { limit: IP_REQUESTS_PER_HOUR, windowSeconds: 3600 } as const;

export interface VerificationDeps {
  db: Database;
  sender: MessageSender;
  /** HMAC key for stored code hashes and signed tokens. */
  secret: string;
  limiter: RateLimiter;
  /** Shown when no channel can deliver the code (ADR-016). */
  contact: VenueContact;
}

const phoneInput = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .transform(normalizePhone)
  .refine(isE164, "Enter a phone number in international format.");

const localeInput = z.enum(["ar", "en"]).default("ar");

const codeInput = z
  .string()
  .trim()
  .regex(
    new RegExp(`^\\d{${CODE_DIGITS}}$`),
    `Enter the ${CODE_DIGITS}-digit code.`,
  );

const plusMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);
const plusSeconds = (date: Date, seconds: number) =>
  new Date(date.getTime() + seconds * 1000);

function phoneKey(phone: string): string {
  return `verification:phone:${phone}`;
}

function phoneHourKey(phone: string): string {
  return `verification:phone-hour:${phone}`;
}

function ipKey(ip: string): string {
  return `verification:ip:${ip}`;
}

function waitFor(
  deps: VerificationDeps,
  phone: string,
  ip: string | undefined,
  now: Date,
): number {
  return Math.max(
    deps.limiter.retryAfter(phoneKey(phone), RESEND_RULE, now),
    deps.limiter.retryAfter(phoneHourKey(phone), PHONE_RULE, now),
    ip ? deps.limiter.retryAfter(ipKey(ip), IP_RULE, now) : 0,
  );
}

function recordAttempts(
  deps: VerificationDeps,
  phone: string,
  ip: string | undefined,
  now: Date,
): void {
  deps.limiter.record(phoneKey(phone), RESEND_RULE, now);
  deps.limiter.record(phoneHourKey(phone), PHONE_RULE, now);
  if (ip) deps.limiter.record(ipKey(ip), IP_RULE, now);
}

export function createVerificationOperations(resolve: () => VerificationDeps) {
  const request = defineOperation({
    name: "verification.request",
    access: "anonymous",
    input: z.object({ phone: phoneInput, locale: localeInput }),
    handler: async ({ phone, locale }, ctx) => {
      const deps = resolve();
      const now = ctx.clock.now();
      const wait = waitFor(deps, phone, ctx.ip, now);
      if (wait > 0) {
        ctx.log.warn("verification request rate limited");
        throw new ApiError(
          "RATE_LIMITED",
          "Too many code requests. Try again shortly.",
          { retryAfterSeconds: wait },
        );
      }
      recordAttempts(deps, phone, ctx.ip, now);

      const code = generateCode();
      const expiresAt = plusMinutes(now, CODE_TTL_MINUTES);
      const [row] = await deps.db
        .insert(phoneVerification)
        .values({
          phone,
          codeHash: hashCode(phone, code, deps.secret),
          expiresAt,
          createdAt: now,
        })
        .returning({ id: phoneVerification.id });

      let channel: Channel;
      try {
        ({ channel } = await sendInline(
          { sender: deps.sender, logger: ctx.log },
          {
            template: "code",
            recipient: phone,
            values: { code, minutes: String(CODE_TTL_MINUTES) },
            locale,
          },
        ));
      } catch (error) {
        // No code reached the customer, so there is nothing to check: drop the
        // row rather than leave a usable code behind (ADR-016).
        if (row) {
          await deps.db
            .delete(phoneVerification)
            .where(eq(phoneVerification.id, row.id));
        }
        if (error instanceof MessageDeliveryError) {
          ctx.log.error("verification code could not be delivered");
          throw new ApiError(
            "CODE_DELIVERY_FAILED",
            "The code could not be delivered on any channel.",
            { phone: deps.contact.phone, whatsapp: deps.contact.whatsapp },
          );
        }
        throw error;
      }

      return {
        phone,
        channel,
        expiresAt: expiresAt.toISOString(),
        resendAt: plusSeconds(now, RESEND_DELAY_SECONDS).toISOString(),
      };
    },
  });

  const check = defineOperation({
    name: "verification.check",
    access: "anonymous",
    input: z.object({ phone: phoneInput, code: codeInput }),
    handler: async ({ phone, code }, ctx) => {
      const deps = resolve();
      const now = ctx.clock.now();

      // The attempt counter must survive a wrong code, so the transaction
      // returns an outcome and the error is thrown after it commits.
      const outcome = await deps.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(phoneVerification)
          .where(
            and(
              eq(phoneVerification.phone, phone),
              isNull(phoneVerification.consumedAt),
            ),
          )
          .orderBy(
            desc(phoneVerification.createdAt),
            desc(phoneVerification.id),
          )
          .limit(1)
          .for("update");

        if (!row || row.expiresAt.getTime() <= now.getTime()) {
          return { kind: "expired" as const };
        }
        if (row.attempts >= MAX_CODE_ATTEMPTS) {
          return { kind: "too-many" as const };
        }

        if (!codeMatches(row.codeHash, phone, code, deps.secret)) {
          const attempts = row.attempts + 1;
          await tx
            .update(phoneVerification)
            .set({ attempts })
            .where(eq(phoneVerification.id, row.id));
          return attempts >= MAX_CODE_ATTEMPTS
            ? { kind: "too-many" as const }
            : {
                kind: "invalid" as const,
                attemptsLeft: MAX_CODE_ATTEMPTS - attempts,
              };
        }

        await tx
          .update(phoneVerification)
          .set({ consumedAt: now })
          .where(eq(phoneVerification.id, row.id));
        const { token, expiresAt } = issueVerifiedPhoneToken(
          phone,
          now,
          deps.secret,
        );
        return { kind: "ok" as const, token, expiresAt };
      });

      if (outcome.kind === "ok") {
        return {
          token: outcome.token,
          phone,
          expiresAt: outcome.expiresAt.toISOString(),
          tokenMinutes: VERIFIED_PHONE_TOKEN_MINUTES,
        };
      }
      if (outcome.kind === "expired") {
        throw new ApiError(
          "CODE_EXPIRED",
          "The code has expired or was not requested.",
        );
      }
      if (outcome.kind === "invalid") {
        throw new ApiError("CODE_INVALID", "The code is not correct.", {
          attemptsLeft: outcome.attemptsLeft,
        });
      }
      throw new ApiError(
        "TOO_MANY_ATTEMPTS",
        "Too many wrong attempts for this code.",
        { attemptsLeft: 0 },
      );
    },
  });

  return { request, check };
}

const limiter = createRateLimiter();

export const verificationOperations = createVerificationOperations(() => ({
  db: getDb(),
  sender: getSender(),
  secret: verificationSecret(),
  limiter,
  contact: venueContact,
}));
