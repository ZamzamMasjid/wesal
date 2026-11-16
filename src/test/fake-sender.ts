// Twilio is never called from tests. The fake sender records what would have
// been sent and can be told to fail a channel. It implements the messaging
// adapter's MessageSender (src/messaging/sender.ts).
import type {
  Channel,
  MessageSender,
  OutgoingMessage,
} from "@/messaging/sender";

export type { Channel, MessageSender, OutgoingMessage };

export interface FakeSender extends MessageSender {
  readonly sent: OutgoingMessage[];
  /** Make every later send on `channel` throw, until `recover` is called. */
  failChannel(channel: Channel, error?: Error): void;
  recover(channel: Channel): void;
  reset(): void;
}

export function createFakeSender(): FakeSender {
  const sent: OutgoingMessage[] = [];
  const failing = new Map<Channel, Error>();
  return {
    sent,
    async send(message) {
      const error = failing.get(message.channel);
      if (error) throw error;
      sent.push(message);
      return { providerMessageId: `fake-${sent.length}` };
    },
    failChannel(channel, error = new Error(`${channel} delivery failed`)) {
      failing.set(channel, error);
    },
    recover(channel) {
      failing.delete(channel);
    },
    reset() {
      sent.length = 0;
      failing.clear();
    },
  };
}
