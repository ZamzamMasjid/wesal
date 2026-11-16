import type { Logger } from "@/lib/logger";

import type { MessageSender } from "./sender";

/**
 * Development sender: writes the message to the log instead of sending it, so a
 * developer can read the verification code. Never calls a provider. With
 * `revealContent: false` only the channel is logged.
 */
export function createLogSender(
  logger: Logger,
  options: { revealContent?: boolean } = {},
): MessageSender {
  const { revealContent = true } = options;
  let counter = 0;
  return {
    async send(message) {
      counter += 1;
      // Outside development the recipient and text (a verification code) stay out of the logs.
      logger.info(
        "message (not sent: log sender)",
        revealContent
          ? { channel: message.channel, to: message.to, body: message.body }
          : { channel: message.channel },
      );
      return { providerMessageId: `log-${counter}` };
    },
  };
}
