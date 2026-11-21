// SPEC: docs/architecture/overview.md — Health: in WhatSend mode the health check reports whether the worker's WhatsApp session is linked
// SPEC: docs/decisions/ADR-031-whatsend-worker-as-fee-free-whatsapp-provider.md — an unlinked session is visible before a customer reports it
// ROADMAP: phase-1-infrastructure / deployment / Add health endpoint and static fallback notice with venue phone and WhatsApp
import { describe, expect, it } from "vitest";

import { createMessagingProbe } from "./status";

const config = {
  MESSAGING_PROVIDER: "whatsend",
  WHATSEND_WORKER_URL: "http://127.0.0.1:3001/",
  WHATSEND_WORKER_SECRET: "worker-secret",
  WHATSEND_SESSION_ID: "0b0f6a3e-1111-4222-8333-444455556666",
};

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond();
  };
  return { fetch: impl as typeof fetch, calls };
}

describe("messaging health probe", () => {
  it("asks the worker's session status with the bearer secret", async () => {
    const { fetch, calls } = fakeFetch(() =>
      Response.json({
        data: { id: config.WHATSEND_SESSION_ID, state: "connected" },
      }),
    );
    const result = await createMessagingProbe(config, fetch)();
    expect(result).toEqual({ provider: "whatsend", session: "linked" });
    expect(calls[0]!.url).toBe(
      `http://127.0.0.1:3001/api/v1/sessions/${config.WHATSEND_SESSION_ID}/status`,
    );
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer worker-secret");
  });

  it("reports every other worker state as unlinked", async () => {
    for (const state of [
      "qr_required",
      "disconnected",
      "reconnecting",
      "failed",
    ]) {
      const { fetch } = fakeFetch(() => Response.json({ data: { state } }));
      expect(await createMessagingProbe(config, fetch)()).toEqual({
        provider: "whatsend",
        session: "unlinked",
      });
    }
  });

  it("reports an unreachable worker as unknown instead of throwing", async () => {
    const { fetch } = fakeFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    expect(await createMessagingProbe(config, fetch)()).toEqual({
      provider: "whatsend",
      session: "unknown",
    });
  });

  it("reports a worker error or a missing state as unknown", async () => {
    for (const respond of [
      () =>
        Response.json({ error: { code: "not_connected" } }, { status: 409 }),
      () => Response.json({ data: {} }),
      () => new Response("not json", { status: 200 }),
    ]) {
      const { fetch } = fakeFetch(respond);
      expect(await createMessagingProbe(config, fetch)()).toMatchObject({
        provider: "whatsend",
        session: "unknown",
      });
    }
  });

  it("reports unknown without calling the worker when its settings are missing", async () => {
    const { fetch, calls } = fakeFetch(() => Response.json({}));
    const probe = createMessagingProbe(
      { MESSAGING_PROVIDER: "whatsend" },
      fetch,
    );
    expect(await probe()).toEqual({ provider: "whatsend", session: "unknown" });
    expect(calls).toHaveLength(0);
  });

  it("does not probe Twilio or an unconfigured sender", async () => {
    const { fetch, calls } = fakeFetch(() => Response.json({}));
    expect(
      await createMessagingProbe({ MESSAGING_PROVIDER: "twilio" }, fetch)(),
    ).toEqual({
      provider: "twilio",
    });
    expect(await createMessagingProbe({}, fetch)()).toEqual({
      provider: "none",
    });
    expect(calls).toHaveLength(0);
  });
});
