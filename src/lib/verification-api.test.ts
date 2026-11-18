// SPEC: docs/features/phone-verification — POST /verification/request and /verification/check use the API envelope
// ROADMAP: phase-2-foundations / phone-verification / Implement code entry step UI with resend timer and error states
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkVerificationCode,
  requestVerificationCode,
} from "./verification-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestVerificationCode", () => {
  it("posts the phone and locale and returns the envelope", async () => {
    const data = {
      phone: "+201001234567",
      channel: "whatsapp",
      expiresAt: "2026-01-01T10:05:00.000Z",
      resendAt: "2026-01-01T10:01:00.000Z",
    };
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ ok: true, data }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestVerificationCode("+201001234567", "ar");

    expect(result).toEqual({ ok: true, data });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/verification/request");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(JSON.parse(String(init!.body))).toEqual({
      phone: "+201001234567",
      locale: "ar",
    });
  });
});

describe("checkVerificationCode", () => {
  it("posts the phone and code and passes an error code through", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        ok: false,
        error: { code: "CODE_INVALID", details: { attemptsLeft: 4 } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkVerificationCode("+201001234567", "123456");

    expect(result).toEqual({
      ok: false,
      error: { code: "CODE_INVALID", details: { attemptsLeft: 4 } },
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/verification/check");
    expect(JSON.parse(String(init!.body))).toEqual({
      phone: "+201001234567",
      code: "123456",
    });
  });

  it("turns a network failure into a stable code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await checkVerificationCode("+201001234567", "123456")).toEqual({
      ok: false,
      error: { code: "NETWORK" },
    });
  });
});
