import { runtime } from "@/lib/runtime";

// Push delivery behind the messaging adapter (ADR-006, ADR-034). The app
// registers an Expo push token per device; the outbox resolves a staff member's
// devices when it sends, so a phone replaced between queueing and sending still
// gets the alert. The provider is a replaceable detail: tests inject a fake, and
// without credentials development logs instead of sending.

export interface PushMessage {
  /** Expo push token. */
  to: string;
  title: string;
  body: string;
  /** Delivered to the app so a tap can open the right screen. */
  data?: Record<string, string>;
}

export interface PushTicket {
  token: string;
  ok: boolean;
  /** The provider says this token no longer exists; stop using it. */
  invalid?: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface PushProvider {
  /** Resolves with one ticket per message; throws only when the call itself failed. */
  send(messages: PushMessage[]): Promise<PushTicket[]>;
}

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const BATCH = 100;

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export function createExpoPushProvider(options: {
  accessToken?: string;
  fetchImpl?: typeof fetch;
}): PushProvider {
  const send = options.fetchImpl ?? fetch;
  return {
    async send(messages) {
      const tickets: PushTicket[] = [];
      for (let start = 0; start < messages.length; start += BATCH) {
        const batch = messages.slice(start, start + BATCH);
        const response = await send(EXPO_ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            ...(options.accessToken
              ? { authorization: `Bearer ${options.accessToken}` }
              : {}),
          },
          body: JSON.stringify(
            batch.map((message) => ({
              to: message.to,
              title: message.title,
              body: message.body,
              data: message.data ?? {},
              sound: "default",
            })),
          ),
        });
        if (!response.ok) {
          throw new Error(`Expo push failed with HTTP ${response.status}.`);
        }
        const body = (await response.json()) as { data?: ExpoTicket[] };
        const answers = body.data ?? [];
        batch.forEach((message, index) => {
          const answer = answers[index];
          if (answer?.status === "ok") {
            tickets.push({
              token: message.to,
              ok: true,
              providerMessageId: answer.id,
            });
            return;
          }
          const error = answer?.details?.error ?? answer?.message ?? "unknown";
          tickets.push({
            token: message.to,
            ok: false,
            invalid: error === "DeviceNotRegistered",
            error,
          });
        });
      }
      return tickets;
    },
  };
}

/** Development: records what would be sent and always accepts it. */
export function createLogPushProvider(
  logger: Pick<typeof runtime.logger, "info"> = runtime.logger,
): PushProvider {
  return {
    async send(messages) {
      for (const message of messages) {
        logger.info("push (not sent: log provider)", {
          to: message.to,
          title: message.title,
          body: message.body,
        });
      }
      return messages.map((message, index) => ({
        token: message.to,
        ok: true,
        providerMessageId: `log-push-${index}`,
      }));
    },
  };
}

let shared: PushProvider | undefined;

/** The app-wide push provider, chosen from the environment. */
export function getPushProvider(
  env: Record<string, string | undefined> = process.env,
): PushProvider {
  shared ??= env.EXPO_ACCESS_TOKEN
    ? createExpoPushProvider({ accessToken: env.EXPO_ACCESS_TOKEN })
    : createLogPushProvider();
  if (!env.EXPO_ACCESS_TOKEN && env.NODE_ENV === "production") {
    runtime.logger.warn(
      "EXPO_ACCESS_TOKEN is not set: push notifications are only logged, none are sent",
    );
  }
  return shared;
}
