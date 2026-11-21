import { probeWhatSendSession, type WhatSendSessionStatus } from "./whatsend";

// The messaging half of the health check (overview: "Health"). It answers one
// question for the owner: is the provider that actually sends messages able to
// send right now? Twilio is reached over the public internet and needs no local
// probe, so only the WhatSend worker is asked about its linked session. The
// probe never throws; an unreachable worker is reported as "unknown" so the
// health endpoint stays a status page instead of turning into a failure.

type Env = Record<string, string | undefined>;

export interface MessagingHealth {
  provider: "twilio" | "whatsend" | "none";
  session?: WhatSendSessionStatus;
}

export type MessagingProbe = () => Promise<MessagingHealth>;

export function createMessagingProbe(
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): MessagingProbe {
  return async () => {
    if (env.MESSAGING_PROVIDER === "whatsend") {
      const workerUrl = env.WHATSEND_WORKER_URL;
      const secret = env.WHATSEND_WORKER_SECRET;
      const sessionId = env.WHATSEND_SESSION_ID;
      if (!workerUrl || !secret || !sessionId) {
        return { provider: "whatsend", session: "unknown" };
      }
      return {
        provider: "whatsend",
        session: await probeWhatSendSession({
          workerUrl,
          secret,
          sessionId,
          fetch: fetchImpl,
        }),
      };
    }
    if (env.MESSAGING_PROVIDER === "twilio") return { provider: "twilio" };
    return { provider: "none" };
  };
}
