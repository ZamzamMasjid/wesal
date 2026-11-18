// SPEC: docs/features/phone-verification — codes are sent inline, stored hashed with an expiry and attempt limit; a check issues a short-lived token bound to the phone; both channels failing returns CODE_DELIVERY_FAILED with the venue contact; requests are rate-limited per phone and IP
// ROADMAP: phase-2-foundations / phone-verification / Implement request-code endpoint: hashed code, expiry, rate limits per phone and IP
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Caller } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { phoneVerification } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rate-limit";
import { openTestDb, resetDatabase } from "@/test/db";
import { createFakeClock } from "@/test/fake-clock";
import { createFakeSender } from "@/test/fake-sender";

import { verifyVerifiedPhoneToken } from "./token";
import {
  createVerificationOperations,
  IP_REQUESTS_PER_HOUR,
  type VerificationDeps,
} from "./verification";

const handle = openTestDb();
const { db } = handle;
const clock = createFakeClock();
const logs: string[] = [];
const logger = createLogger({ clock, write: (line) => logs.push(line) });
const sender = createFakeSender();
const secret = "test-secret";
const contact = { phone: "+201111111111", whatsapp: "+201222222222" };
const phone = "+201001234567";

let ops: ReturnType<typeof createVerificationOperations>;

beforeEach(async () => {
  await resetDatabase(handle);
  sender.reset();
  logs.length = 0;
  clock.set(new Date("2026-01-01T10:00:00Z"));
  const deps: VerificationDeps = {
    db,
    sender,
    secret,
    limiter: createRateLimiter(),
    contact,
  };
  ops = createVerificationOperations(() => deps);
});

afterAll(() => handle.pool.end());

const anon: Caller = { kind: "anonymous" };
const ctx = (ip: string | null = "203.0.113.7") =>
  createCallContext(anon, {
    requestId: "r",
    deps: { clock, logger },
    ...(ip ? { ip } : {}),
  });

async function requestCode(target = phone): Promise<void> {
  const result = await ops.request({ phone: target, locale: "en" }, ctx());
  if (!result.ok) throw new Error(`request failed: ${result.error.code}`);
}

/** The code the fake sender saw; the API never returns it. */
function sentCode(): string {
  const body = sender.sent.at(-1)?.body ?? "";
  const match = body.match(/\d{6}/);
  if (!match) throw new Error(`no code in message: ${body}`);
  return match[0];
}

async function rows() {
  return db.select().from(phoneVerification);
}

describe("verification.request", () => {
  it("sends the code inline and stores only a hash with an expiry", async () => {
    const result = await ops.request(
      { phone: "01001234567", locale: "en" },
      ctx(),
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        phone,
        channel: "whatsapp",
        expiresAt: "2026-01-01T10:05:00.000Z",
        resendAt: "2026-01-01T10:01:00.000Z",
      },
    });
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({
      channel: "whatsapp",
      to: phone,
    });
    expect(sender.sent[0]!.body).toContain("Wesal verification code");

    const code = sentCode();
    const [row] = await rows();
    expect(row).toMatchObject({ phone, attempts: 0, consumedAt: null });
    expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.codeHash).not.toContain(code);
    expect(row!.expiresAt).toEqual(new Date("2026-01-01T10:05:00Z"));
  });

  it("falls back to SMS when WhatsApp fails", async () => {
    sender.failChannel("whatsapp");
    const result = await ops.request({ phone, locale: "en" }, ctx());
    expect(result.ok && result.data.channel).toBe("sms");
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.channel).toBe("sms");
  });

  it("stops the booking with the venue contact when both channels fail", async () => {
    sender.failChannel("whatsapp");
    sender.failChannel("sms");

    const result = await ops.request({ phone, locale: "en" }, ctx());

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CODE_DELIVERY_FAILED", details: contact },
    });
    expect(await rows()).toHaveLength(0);
    expect(sender.sent).toHaveLength(0);
  });

  it("refuses a malformed phone", async () => {
    const result = await ops.request({ phone: "123", locale: "en" }, ctx());
    expect(!result.ok && result.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("verification.check", () => {
  it("accepts the right code once and issues a token for that phone", async () => {
    await requestCode();
    const code = sentCode();

    const result = await ops.check({ phone, code }, ctx());

    expect(result.ok && result.data).toMatchObject({
      phone,
      tokenMinutes: 10,
    });
    if (!result.ok) throw new Error("expected success");
    expect(
      verifyVerifiedPhoneToken(result.data.token, phone, clock.now(), secret),
    ).toBe(true);
    expect(
      verifyVerifiedPhoneToken(
        result.data.token,
        "+201001234568",
        clock.now(),
        secret,
      ),
    ).toBe(false);

    const [row] = await rows();
    expect(row!.consumedAt).toEqual(clock.now());

    const again = await ops.check({ phone, code }, ctx());
    expect(!again.ok && again.error.code).toBe("CODE_EXPIRED");
  });

  it("counts wrong attempts and stops at the limit", async () => {
    await requestCode();
    const code = sentCode();
    const wrong = code === "000000" ? "000001" : "000000";

    const first = await ops.check({ phone, code: wrong }, ctx());
    expect(first).toMatchObject({
      ok: false,
      error: { code: "CODE_INVALID", details: { attemptsLeft: 4 } },
    });

    for (let attempt = 2; attempt <= 5; attempt += 1) {
      const result = await ops.check({ phone, code: wrong }, ctx());
      if (attempt < 5) {
        expect(!result.ok && result.error.code).toBe("CODE_INVALID");
      } else {
        expect(!result.ok && result.error.code).toBe("TOO_MANY_ATTEMPTS");
      }
    }

    const correct = await ops.check({ phone, code }, ctx());
    expect(!correct.ok && correct.error.code).toBe("TOO_MANY_ATTEMPTS");
    const [row] = await rows();
    expect(row).toMatchObject({ attempts: 5, consumedAt: null });
  });

  it("accepts a fresh code after the attempt limit", async () => {
    await requestCode();
    const wrong = sentCode() === "000000" ? "000001" : "000000";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await ops.check({ phone, code: wrong }, ctx());
    }
    clock.advanceMinutes(1);

    await requestCode();
    const result = await ops.check({ phone, code: sentCode() }, ctx());
    expect(result.ok).toBe(true);
  });

  it("refuses an expired code", async () => {
    await requestCode();
    const code = sentCode();
    clock.advanceMinutes(5);

    const result = await ops.check({ phone, code }, ctx());
    expect(!result.ok && result.error.code).toBe("CODE_EXPIRED");
  });

  it("refuses when no code was requested", async () => {
    const result = await ops.check({ phone, code: "123456" }, ctx());
    expect(!result.ok && result.error.code).toBe("CODE_EXPIRED");
  });

  it("refuses a malformed code", async () => {
    const result = await ops.check({ phone, code: "12" }, ctx());
    expect(!result.ok && result.error.code).toBe("VALIDATION_FAILED");
  });

  it("lets exactly one of two concurrent checks use the code", async () => {
    await requestCode();
    const code = sentCode();

    const results = await Promise.all([
      ops.check({ phone, code }, ctx()),
      ops.check({ phone, code }, ctx()),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });
});

describe("request rate limits", () => {
  it("refuses a second request inside the resend delay, then allows it", async () => {
    await requestCode();

    const limited = await ops.request({ phone, locale: "en" }, ctx());
    expect(limited).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED", details: { retryAfterSeconds: 60 } },
    });

    clock.advance(60_000);
    const allowed = await ops.request({ phone, locale: "en" }, ctx());
    expect(allowed.ok).toBe(true);
  });

  it("caps requests per phone per hour", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await requestCode();
      clock.advance(61_000);
    }

    const limited = await ops.request({ phone, locale: "en" }, ctx());
    expect(!limited.ok && limited.error.code).toBe("RATE_LIMITED");
    if (limited.ok) throw new Error("expected a limit");
    expect(
      Number(limited.error.details?.retryAfterSeconds ?? 0),
    ).toBeGreaterThan(0);
  });

  it("caps requests per IP per hour across different numbers", async () => {
    for (let index = 0; index < IP_REQUESTS_PER_HOUR; index += 1) {
      const target = `+2010${String(index).padStart(8, "0")}`;
      const result = await ops.request(
        { phone: target, locale: "en" },
        ctx("198.51.100.9"),
      );
      expect(result.ok).toBe(true);
    }

    const limited = await ops.request(
      { phone: "+201099999999", locale: "en" },
      ctx("198.51.100.9"),
    );
    expect(!limited.ok && limited.error.code).toBe("RATE_LIMITED");
  });

  it("does not apply the per-IP limit when the address is unknown", async () => {
    for (let index = 0; index < IP_REQUESTS_PER_HOUR + 1; index += 1) {
      const target = `+2010${String(index).padStart(8, "0")}`;
      const result = await ops.request(
        { phone: target, locale: "en" },
        ctx(null),
      );
      expect(result.ok).toBe(true);
    }
  });
});
