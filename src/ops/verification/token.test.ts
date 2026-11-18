// SPEC: docs/features/phone-verification — a successful check issues a short-lived token bound to that phone number
// ROADMAP: phase-2-foundations / phone-verification / Implement check-code endpoint issuing a short-lived verified-phone token
import { describe, expect, it } from "vitest";

import {
  issueVerifiedPhoneToken,
  readVerifiedPhoneToken,
  VERIFIED_PHONE_TOKEN_MINUTES,
  verifyVerifiedPhoneToken,
} from "./token";

const secret = "test-secret";
const now = new Date("2026-01-01T10:00:00Z");
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

describe("verified-phone tokens", () => {
  it("issues a token bound to the phone and its expiry", () => {
    const { token, expiresAt } = issueVerifiedPhoneToken(
      "+201001234567",
      now,
      secret,
    );
    expect(expiresAt).toEqual(later(VERIFIED_PHONE_TOKEN_MINUTES));
    expect(readVerifiedPhoneToken(token, now, secret)).toEqual({
      phone: "+201001234567",
      expiresAt,
    });
    expect(verifyVerifiedPhoneToken(token, "+201001234567", now, secret)).toBe(
      true,
    );
  });

  it("normalizes the phone it is issued for", () => {
    const { token } = issueVerifiedPhoneToken("01001234567", now, secret);
    expect(verifyVerifiedPhoneToken(token, "+201001234567", now, secret)).toBe(
      true,
    );
  });

  it("is refused for another phone", () => {
    const { token } = issueVerifiedPhoneToken("+201001234567", now, secret);
    expect(verifyVerifiedPhoneToken(token, "+201001234568", now, secret)).toBe(
      false,
    );
  });

  it("expires", () => {
    const { token } = issueVerifiedPhoneToken("+201001234567", now, secret);
    expect(
      verifyVerifiedPhoneToken(
        token,
        "+201001234567",
        later(VERIFIED_PHONE_TOKEN_MINUTES - 1),
        secret,
      ),
    ).toBe(true);
    expect(
      verifyVerifiedPhoneToken(
        token,
        "+201001234567",
        later(VERIFIED_PHONE_TOKEN_MINUTES),
        secret,
      ),
    ).toBe(false);
  });

  it("refuses a token signed with another secret or altered in transit", () => {
    const { token } = issueVerifiedPhoneToken("+201001234567", now, secret);
    expect(verifyVerifiedPhoneToken(token, "+201001234567", now, "other")).toBe(
      false,
    );

    const [version, body, signature] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ phone: "+201001234568", exp: 9999999999 }),
    ).toString("base64url");
    expect(
      verifyVerifiedPhoneToken(
        `${version}.${forgedBody}.${signature}`,
        "+201001234568",
        now,
        secret,
      ),
    ).toBe(false);
    expect(
      verifyVerifiedPhoneToken(
        `${version}.${body}.${signature![0] === "A" ? "B" : "A"}${signature!.slice(1)}`,
        "+201001234567",
        now,
        secret,
      ),
    ).toBe(false);
  });

  it("refuses malformed tokens without throwing", () => {
    for (const bad of [
      "",
      "v1",
      "v2.a.b",
      "v1.not-json.signature",
      "v1..",
      `v1.${Buffer.from("null").toString("base64url")}.x`,
    ]) {
      expect(readVerifiedPhoneToken(bad, now, secret)).toBeNull();
    }
  });
});
