// SPEC: message-delivery/spec.md — a fake sender is used in development and tests; Twilio only when configured
// ROADMAP: phase-2-foundations / message-delivery / Define messaging adapter interface with fake sender and Twilio implementation
import { describe, expect, it } from "vitest";

import { createSenderFromEnv, publicBaseUrl, twilioStatusUrl } from "./config";

describe("messaging config", () => {
  it("uses the log-only sender unless Twilio is selected", async () => {
    const sender = createSenderFromEnv({ NODE_ENV: "test" });
    const result = await sender.send({
      channel: "sms",
      to: "+20",
      body: "never leaves the process",
    });
    expect(result.providerMessageId).toMatch(/^log-/);
  });

  it("keeps recipient and text out of the logs in production", async () => {
    const logged: string[] = [];
    const { createLogSender } = await import("./log-sender");
    const { createLogger } = await import("@/lib/logger");
    const logger = createLogger({
      clock: { now: () => new Date(0) },
      write: (line) => logged.push(line),
    });
    const message = {
      channel: "sms" as const,
      to: "+201001234567",
      body: "code 123456",
    };
    await createLogSender(logger, { revealContent: false }).send(message);
    await createLogSender(logger).send(message);
    expect(logged[0]).not.toMatch(/201001234567|123456/);
    expect(logged[1]).toContain("123456");
  });

  it("refuses to start Twilio without its credentials", () => {
    expect(() =>
      createSenderFromEnv({
        MESSAGING_PROVIDER: "twilio",
        BETTER_AUTH_URL: "https://wesal.example",
      }),
    ).toThrow(/TWILIO_ACCOUNT_SID/);
  });

  it("builds the Twilio sender when fully configured", () => {
    const sender = createSenderFromEnv({
      MESSAGING_PROVIDER: "twilio",
      TWILIO_ACCOUNT_SID: "ACx",
      TWILIO_AUTH_TOKEN: "t",
      TWILIO_WHATSAPP_FROM: "+1415",
      TWILIO_SMS_FROM: "Wesal",
      PUBLIC_BASE_URL: "https://wesal.example/",
    });
    expect(typeof sender.send).toBe("function");
  });

  it("derives the public webhook URL from PUBLIC_BASE_URL, then BETTER_AUTH_URL", () => {
    expect(
      twilioStatusUrl({
        PUBLIC_BASE_URL: "https://a.example/",
        BETTER_AUTH_URL: "https://b.example",
      }),
    ).toBe("https://a.example/api/v1/webhooks/twilio/status");
    expect(publicBaseUrl({ BETTER_AUTH_URL: "https://b.example" })).toBe(
      "https://b.example",
    );
    expect(() => publicBaseUrl({})).toThrow(/PUBLIC_BASE_URL/);
  });
});
