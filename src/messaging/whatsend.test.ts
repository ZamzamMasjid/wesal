// SPEC: message-delivery/spec.md — the provider behind the adapter is replaceable; a fee-free WhatsApp-only provider is available
// ROADMAP: phase-2-foundations / message-delivery / Define messaging adapter interface with fake sender and Twilio implementation
import { describe, expect, it } from "vitest";

import { createSenderFromEnv } from "./config";
import { MessageSendError } from "./sender";
import { createWhatSendSender } from "./whatsend";

const config = {
  workerUrl: "http://127.0.0.1:3001/",
  secret: "worker-secret",
  sessionId: "0b0f6a3e-1111-4222-8333-444455556666",
};

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond();
  };
  return { fetch: impl as typeof fetch, calls };
}

describe("whatsend sender", () => {
  it("posts the message to the worker session with a bearer secret", async () => {
    const { fetch, calls } = fakeFetch(() =>
      Response.json(
        { data: { id: "op-1", status: "pending" } },
        { status: 202 },
      ),
    );
    const result = await createWhatSendSender({ ...config, fetch }).send({
      channel: "whatsapp",
      to: "+201001234567",
      body: "hello",
    });
    expect(result.providerMessageId).toBe("op-1");
    expect(calls[0]!.url).toBe(
      `http://127.0.0.1:3001/api/v1/sessions/${config.sessionId}/messages`,
    );
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer worker-secret");
    expect(headers["idempotency-key"]).toBeTruthy();
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      recipient: "+201001234567",
      text: "hello",
    });
  });

  it("never sends SMS", async () => {
    const { fetch, calls } = fakeFetch(() => Response.json({}));
    await expect(
      createWhatSendSender({ ...config, fetch }).send({
        channel: "sms",
        to: "+20",
        body: "x",
      }),
    ).rejects.toBeInstanceOf(MessageSendError);
    expect(calls).toHaveLength(0);
  });

  it("reports a worker rejection, such as a session that is not linked", async () => {
    const { fetch } = fakeFetch(() =>
      Response.json(
        { error: { code: "not_connected", message: "Scan the QR code." } },
        { status: 409 },
      ),
    );
    await expect(
      createWhatSendSender({ ...config, fetch }).send({
        channel: "whatsapp",
        to: "+20",
        body: "x",
      }),
    ).rejects.toMatchObject({ status: 409, message: /not_connected/ });
  });

  it("reports an unreachable worker", async () => {
    const { fetch } = fakeFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    await expect(
      createWhatSendSender({ ...config, fetch }).send({
        channel: "whatsapp",
        to: "+20",
        body: "x",
      }),
    ).rejects.toThrow(/ECONNREFUSED/);
  });
});

describe("whatsend selection", () => {
  it("refuses to start without its worker settings", () => {
    expect(() =>
      createSenderFromEnv({ MESSAGING_PROVIDER: "whatsend" }),
    ).toThrow(/WHATSEND_WORKER_URL/);
  });

  it("builds the sender when configured", () => {
    expect(
      createSenderFromEnv({
        MESSAGING_PROVIDER: "whatsend",
        WHATSEND_WORKER_URL: "http://127.0.0.1:3001",
        WHATSEND_WORKER_SECRET: "s",
        WHATSEND_SESSION_ID: config.sessionId,
      }).send,
    ).toBeTypeOf("function");
  });
});
