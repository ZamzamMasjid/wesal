import { systemClock, type Clock } from "./clock";
import { createLogger, parseLogLevel, type Logger } from "./logger";

/**
 * What a service needs from the outside world. Services receive it as an
 * argument, so tests substitute a fake clock and a collecting logger.
 */
export interface Runtime {
  clock: Clock;
  logger: Logger;
}

/** The production wiring: the real clock and a stdout logger. */
export const runtime: Runtime = {
  clock: systemClock,
  logger: createLogger({
    clock: systemClock,
    level: parseLogLevel(process.env.LOG_LEVEL),
  }),
};
