// SPEC: message-delivery/spec.md — Twilio is the first provider behind the adapter; status callbacks are signature-checked
// ROADMAP: phase-2-foundations / message-delivery / Define messaging adapter interface with fake sender and Twilio implementation
import { describe, expect, it } from "vitest";

import { MessageSendError } from "./sender";
import {
  createTwilioSender,
  twilioSignature,
  verifyTwilioSignature,
} from "./twilio";

interface Captured {
  url: string;
  init: RequestInit;
}

function fakeFetch(respond: () => Response | Promise<Response>): {
  fetch: typeof fetch;
  calls: Captured[];
} {
  const calls: Captured[] = [];
  const impl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond();
  };
  return { fetch: impl as typeof fetch, calls };
}

const config = {
  accountSid: "ACtest",
  authToken: "test-token",
  whatsappFrom: "+14155238886",
  smsFrom: "WesalVenue",
  statusCallbackUrl: "https://wesal.example/api/v1/webhooks/twilio/status",
};

describe("twilio sender", () => {
  it("posts a WhatsApp message with whatsapp: prefixes and the status callback", async () => {
    const { fetch, calls } = fakeFetch(() =>
      Response.json({ sid: "SM123" }, { status: 201 }),
    );
    const result = await createTwilioSender({ ...config, fetch }).send({
      channel: "whatsapp",
      to: "+201001234567",
      body: "hello",
    });
    expect(result.providerMessageId).toBe("SM123");
    expect(calls[0]!.url).toBe(
      "https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json",
    );
    const form = calls[0]!.init.body as URLSearchParams;
    expect(form.get("To")).toBe("whatsapp:+201001234567");
    expect(form.get("From")).toBe("whatsapp:+14155238886");
    expect(form.get("Body")).toBe("hello");
    expect(form.get("StatusCallback")).toBe(config.statusCallbackUrl);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(
      `Basic ${Buffer.from("ACtest:test-token").toString("base64")}`,
    );
  });

  it("sends SMS from the SMS sender without a prefix", async () => {
    const { fetch, calls } = fakeFetch(() => Response.json({ sid: "SM9" }));
    await createTwilioSender({ ...config, fetch }).send({
      channel: "sms",
      to: "+201001234567",
      body: "x",
    });
    const form = calls[0]!.init.body as URLSearchParams;
    expect(form.get("To")).toBe("+201001234567");
    expect(form.get("From")).toBe("WesalVenue");
  });

  it("omits the status callback when none is configured", async () => {
    const { fetch, calls } = fakeFetch(() => Response.json({ sid: "SM9" }));
    await createTwilioSender({
      ...config,
      statusCallbackUrl: undefined,
      fetch,
    }).send({ channel: "sms", to: "+20", body: "x" });
    expect((calls[0]!.init.body as URLSearchParams).has("StatusCallback")).toBe(
      false,
    );
  });

  it("throws a MessageSendError carrying Twilio's code when rejected", async () => {
    const { fetch } = fakeFetch(() =>
      Response.json(
        { code: 21608, message: "unverified number" },
        { status: 400 },
      ),
    );
    const error = await createTwilioSender({ ...config, fetch })
      .send({ channel: "sms", to: "+20", body: "x" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MessageSendError);
    expect((error as MessageSendError).status).toBe(400);
    expect((error as Error).message).toContain("21608");
  });

  it("throws a MessageSendError when the response has no sid", async () => {
    const { fetch } = fakeFetch(() => new Response("oops", { status: 200 }));
    await expect(
      createTwilioSender({ ...config, fetch }).send({
        channel: "sms",
        to: "+20",
        body: "x",
      }),
    ).rejects.toBeInstanceOf(MessageSendError);
  });

  it("throws a MessageSendError when the network fails", async () => {
    const { fetch } = fakeFetch(() => {
      throw new Error("ECONNRESET");
    });
    await expect(
      createTwilioSender({ ...config, fetch }).send({
        channel: "whatsapp",
        to: "+20",
        body: "x",
      }),
    ).rejects.toThrow(/ECONNRESET/);
  });
});

describe("twilio signature", () => {
  const url = "https://wesal.example/api/v1/webhooks/twilio/status";
  const params = { MessageSid: "SM1", MessageStatus: "delivered", To: "+20" };

  it("matches Twilio's published example", () => {
    const signature = twilioSignature(
      "12345",
      "https://mycompany.com/myapp.php?foo=1&bar=2",
      {
        CallSid: "CA1234567890ABCDE",
        Caller: "+14158675310",
        Digits: "1234",
        From: "+14158675310",
        To: "+18005551212",
      },
    );
    expect(signature).toBe("GvWf1cFY/Q7PnoempGyD5oXAezc=");
  });

  it("accepts a correct signature and rejects wrong, tampered and missing ones", () => {
    const good = twilioSignature("tok", url, params);
    expect(verifyTwilioSignature("tok", url, params, good)).toBe(true);
    expect(verifyTwilioSignature("other", url, params, good)).toBe(false);
    expect(
      verifyTwilioSignature(
        "tok",
        url,
        { ...params, MessageStatus: "failed" },
        good,
      ),
    ).toBe(false);
    expect(verifyTwilioSignature("tok", url + "x", params, good)).toBe(false);
    expect(verifyTwilioSignature("tok", url, params, "short")).toBe(false);
    expect(verifyTwilioSignature("tok", url, params, null)).toBe(false);
  });
});
