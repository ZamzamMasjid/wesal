// The messaging adapter interface (ADR-006). Everything that sends a message
// goes through a MessageSender; the provider behind it is a replaceable detail.
// Implementations: Twilio (twilio.ts), a log-only sender for development
// (log-sender.ts) and the recording fake used by tests (src/test/fake-sender.ts).

export type Channel = "whatsapp" | "sms";

export interface OutgoingMessage {
  channel: Channel;
  /** E.164 phone number, e.g. +201001234567. */
  to: string;
  body: string;
}

export interface MessageSender {
  /** Resolves once the provider accepted the message; throws if it did not. */
  send(message: OutgoingMessage): Promise<{ providerMessageId: string }>;
}

/** The provider refused or could not be reached. `retryable` is a hint only. */
export class MessageSendError extends Error {
  readonly channel: Channel;
  readonly status?: number;
  constructor(channel: Channel, message: string, status?: number) {
    super(message);
    this.name = "MessageSendError";
    this.channel = channel;
    this.status = status;
  }
}
