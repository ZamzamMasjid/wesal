// Push is never sent in tests. The fake records each batch and can refuse every
// device, report a token as unregistered, or throw when the provider is down.
import type { PushMessage, PushProvider, PushTicket } from "@/messaging/push";

export interface FakePushProvider extends PushProvider {
  readonly sent: PushMessage[][];
  /** Every later send throws (the provider is unreachable). */
  fail(error?: Error): void;
  /** Every later send returns error tickets; `invalid` marks DeviceNotRegistered. */
  reject(error?: string, options?: { invalid?: boolean }): void;
  reset(): void;
}

export function createFakePush(): FakePushProvider {
  const sent: PushMessage[][] = [];
  let failure: Error | null = null;
  let rejection: { error: string; invalid: boolean } | null = null;
  return {
    sent,
    async send(messages) {
      sent.push(messages);
      if (failure) throw failure;
      if (rejection) {
        return messages.map((message): PushTicket => ({
          token: message.to,
          ok: false,
          invalid: rejection?.invalid,
          error: rejection?.error,
        }));
      }
      return messages.map((message, index): PushTicket => ({
        token: message.to,
        ok: true,
        providerMessageId: `fake-push-${sent.length}-${index}`,
      }));
    },
    fail(error = new Error("push provider unavailable")) {
      failure = error;
    },
    reject(error = "push rejected", options = {}) {
      rejection = { error, invalid: options.invalid ?? false };
    },
    reset() {
      sent.length = 0;
      failure = null;
      rejection = null;
    },
  };
}
