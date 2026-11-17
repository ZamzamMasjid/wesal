import { runtime } from "@/lib/runtime";

import { createLogSender } from "./log-sender";
import type { MessageSender } from "./sender";
import { createTwilioSender } from "./twilio";
import { createWhatSendSender } from "./whatsend";

// Chooses the messaging provider from the environment. Development and tests
// never reach Twilio: without MESSAGING_PROVIDER=twilio the sender only logs.

type Env = Record<string, string | undefined>;

export const TWILIO_STATUS_PATH = "/api/v1/webhooks/twilio/status";

/** The public origin Twilio can reach, used to sign and receive the webhook. */
export function publicBaseUrl(env: Env = process.env): string {
  const base = env.PUBLIC_BASE_URL ?? env.BETTER_AUTH_URL;
  if (!base) {
    throw new Error("PUBLIC_BASE_URL (or BETTER_AUTH_URL) is not set.");
  }
  return base.replace(/\/+$/, "");
}

export function twilioStatusUrl(env: Env = process.env): string {
  return `${publicBaseUrl(env)}${TWILIO_STATUS_PATH}`;
}

export function createSenderFromEnv(env: Env = process.env): MessageSender {
  if (env.MESSAGING_PROVIDER === "whatsend") {
    const need = (name: string): string => {
      const value = env[name];
      if (!value) throw new Error(`${name} is not set.`);
      return value;
    };
    return createWhatSendSender({
      workerUrl: need("WHATSEND_WORKER_URL"),
      secret: need("WHATSEND_WORKER_SECRET"),
      sessionId: need("WHATSEND_SESSION_ID"),
    });
  }
  if (env.MESSAGING_PROVIDER !== "twilio") {
    if (env.NODE_ENV === "production") {
      runtime.logger.warn(
        "MESSAGING_PROVIDER is not twilio: messages are only logged, none are sent",
      );
    }
    return createLogSender(runtime.logger, {
      revealContent: env.NODE_ENV !== "production",
    });
  }
  const need = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`${name} is not set.`);
    return value;
  };
  return createTwilioSender({
    accountSid: need("TWILIO_ACCOUNT_SID"),
    authToken: need("TWILIO_AUTH_TOKEN"),
    whatsappFrom: need("TWILIO_WHATSAPP_FROM"),
    smsFrom: need("TWILIO_SMS_FROM"),
    statusCallbackUrl: twilioStatusUrl(env),
  });
}

let shared: MessageSender | undefined;

/** The app-wide sender, created on first use. */
export function getSender(): MessageSender {
  shared ??= createSenderFromEnv();
  return shared;
}
