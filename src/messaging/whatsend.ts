import { randomUUID } from "node:crypto";

import { MessageSendError, type MessageSender } from "./sender";

// A fee-free WhatsApp sender (ADR-031). It talks to the WhatSend project's
// private WhatsApp worker (Baileys, a linked device scanned by QR) over HTTP.
// It reaches WhatsApp only: the SMS channel always fails, so a WhatsApp outage
// shows up as a failed message instead of a silent fallback to a paid channel.
// Tests inject a fake `fetch`; nothing in the test suite reaches the worker.

export interface WhatSendConfig {
  /** Base URL of the worker, e.g. "http://127.0.0.1:3001". */
  workerUrl: string;
  /** The worker's WHATSAPP_WORKER_SECRET, sent as a Bearer token. */
  secret: string;
  /** The linked WhatsApp session (a UUID chosen once and paired by QR). */
  sessionId: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const STATUS_TIMEOUT_MS = 2_000;

/** What the worker says about its WhatsApp link, reduced to what health needs. */
export type WhatSendSessionStatus = "linked" | "unlinked" | "unknown";

/**
 * Asks the worker whether its WhatsApp session is linked. Never throws: the
 * health check reports an unreachable or confused worker as "unknown" instead
 * of failing the whole endpoint. States: the worker reports `connected` when
 * the QR link is live; `qr_required`, `disconnected`, `connecting`,
 * `reconnecting` and `failed` all count as not linked.
 */
export async function probeWhatSendSession(
  config: WhatSendConfig,
): Promise<WhatSendSessionStatus> {
  const doFetch = config.fetch ?? fetch;
  const url = `${config.workerUrl.replace(/\/+$/, "")}/api/v1/sessions/${encodeURIComponent(
    config.sessionId,
  )}/status`;

  let response: Response;
  try {
    response = await doFetch(url, {
      headers: { authorization: `Bearer ${config.secret}` },
      signal: AbortSignal.timeout(config.timeoutMs ?? STATUS_TIMEOUT_MS),
    });
  } catch {
    return "unknown";
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: { state?: string };
  } | null;
  const state = payload?.data?.state;
  if (!response.ok || !state) return "unknown";
  return state === "connected" ? "linked" : "unlinked";
}

export function createWhatSendSender(config: WhatSendConfig): MessageSender {
  const doFetch = config.fetch ?? fetch;
  const url = `${config.workerUrl.replace(/\/+$/, "")}/api/v1/sessions/${encodeURIComponent(
    config.sessionId,
  )}/messages`;

  return {
    async send(message) {
      if (message.channel !== "whatsapp") {
        throw new MessageSendError(
          message.channel,
          "The WhatSend provider cannot send SMS.",
        );
      }

      let response: Response;
      try {
        response = await doFetch(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.secret}`,
            "content-type": "application/json",
            "idempotency-key": randomUUID(),
          },
          body: JSON.stringify({ recipient: message.to, text: message.body }),
          signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        });
      } catch (err) {
        throw new MessageSendError(
          message.channel,
          `WhatSend worker request failed: ${err instanceof Error ? err.message : "unknown"}`,
        );
      }

      const payload = (await response.json().catch(() => null)) as {
        data?: { id?: string };
        error?: { code?: string; message?: string };
      } | null;
      const id = payload?.data?.id;
      if (!response.ok || !id) {
        throw new MessageSendError(
          message.channel,
          `WhatSend worker rejected the message (${response.status}${
            payload?.error?.code ? `, ${payload.error.code}` : ""
          }): ${payload?.error?.message ?? "no detail"}`,
          response.status,
        );
      }
      return { providerMessageId: id };
    },
  };
}
