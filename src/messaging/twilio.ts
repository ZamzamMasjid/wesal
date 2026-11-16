import { createHmac, timingSafeEqual } from "node:crypto";

import { MessageSendError, type MessageSender } from "./sender";

// The Twilio implementation of the messaging adapter (ADR-006). It calls
// Twilio's REST API with fetch, so there is no SDK dependency. Tests inject a
// fake `fetch`; nothing in the test suite reaches Twilio.

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** Sender for WhatsApp, e.g. "+14155238886" (the sandbox), without the "whatsapp:" prefix. */
  whatsappFrom: string;
  /** Sender for SMS: a phone number or a registered alphanumeric sender. */
  smsFrom: string;
  /** Where Twilio posts delivery status; omit to receive no callbacks. */
  statusCallbackUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export function createTwilioSender(config: TwilioConfig): MessageSender {
  const doFetch = config.fetch ?? fetch;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    config.accountSid,
  )}/Messages.json`;
  const authorization = `Basic ${Buffer.from(
    `${config.accountSid}:${config.authToken}`,
  ).toString("base64")}`;

  return {
    async send(message) {
      const whatsapp = message.channel === "whatsapp";
      const form = new URLSearchParams({
        To: whatsapp ? `whatsapp:${message.to}` : message.to,
        From: whatsapp ? `whatsapp:${config.whatsappFrom}` : config.smsFrom,
        Body: message.body,
      });
      if (config.statusCallbackUrl) {
        form.set("StatusCallback", config.statusCallbackUrl);
      }

      let response: Response;
      try {
        response = await doFetch(url, {
          method: "POST",
          headers: {
            authorization,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: form,
          signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        });
      } catch (err) {
        throw new MessageSendError(
          message.channel,
          `Twilio request failed: ${err instanceof Error ? err.message : "unknown"}`,
        );
      }

      const payload = (await response.json().catch(() => null)) as {
        sid?: string;
        message?: string;
        code?: number;
      } | null;
      if (!response.ok || !payload?.sid) {
        throw new MessageSendError(
          message.channel,
          `Twilio rejected the message (${response.status}${
            payload?.code ? `, code ${payload.code}` : ""
          }): ${payload?.message ?? "no detail"}`,
          response.status,
        );
      }
      return { providerMessageId: payload.sid };
    },
  };
}

/**
 * Twilio's request signature: HMAC-SHA1, keyed with the auth token, over the
 * full public URL followed by every POST parameter (sorted by name) as
 * name + value, base64-encoded.
 */
export function twilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", authToken).update(data).digest("base64");
}

/** Constant-time check of a received `X-Twilio-Signature`. */
export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null | undefined,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const received = Buffer.from(signature);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
