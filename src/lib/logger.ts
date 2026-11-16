import type { Clock } from "./clock";

// Structured logging for Fly's log tools (ADR-017): one JSON object per line on
// stdout. Every line has level, time and msg; request- and job-scoped loggers
// add a requestId or jobId through child(), so an incident can be traced after
// the fact.

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** A logger that adds `bindings` to every line, e.g. `{ requestId }` or `{ jobId }`. */
  child(bindings: LogFields): Logger;
}

export interface LoggerOptions {
  clock: Clock;
  /** Lines below this level are dropped. Default "info". */
  level?: LogLevel;
  /** Where a finished line goes. Default: stdout. Tests pass a collector. */
  write?: (line: string) => void;
  bindings?: LogFields;
}

// Keys whose values must never reach the logs: customer phone numbers, one-time
// codes, tokens, credentials. Matched case-insensitively at any depth.
const REDACTED_KEYS = new Set([
  "phone",
  "phonenumber",
  "code",
  "token",
  "verifiedphonetoken",
  "linktoken",
  "password",
  "authorization",
  "cookie",
  "setcookie",
  "secret",
]);
export const REDACTED = "[redacted]";

const RESERVED_KEYS = new Set(["level", "time", "msg"]);

function serializeError(error: Error): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  const code = (error as { code?: unknown }).code;
  if (code !== undefined) out.code = code;
  if (error.cause !== undefined) out.cause = error.cause;
  return out;
}

function makeReplacer() {
  const seen = new WeakSet<object>();
  return function replacer(this: unknown, key: string, value: unknown) {
    if (key !== "" && REDACTED_KEYS.has(key.toLowerCase())) return REDACTED;
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Error) value = serializeError(value);
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  };
}

/** Renders one log line. Never throws: a field that cannot be serialized must not break the caller. */
export function formatLine(
  level: LogLevel,
  time: Date,
  msg: string,
  bindings: LogFields,
  fields: LogFields | undefined,
): string {
  const record: Record<string, unknown> = {
    level,
    time: time.toISOString(),
    msg,
  };
  for (const source of [bindings, fields ?? {}]) {
    for (const [key, value] of Object.entries(source)) {
      // A field cannot overwrite level, time or msg; keep its value under _key.
      record[RESERVED_KEYS.has(key) ? `_${key}` : key] = value;
    }
  }
  try {
    return JSON.stringify(record, makeReplacer());
  } catch {
    return JSON.stringify({
      level,
      time: time.toISOString(),
      msg,
      logError: "fields could not be serialized",
    });
  }
}

export function createLogger(options: LoggerOptions): Logger {
  const {
    clock,
    level: minLevel = "info",
    write = (line) => {
      process.stdout.write(`${line}\n`);
    },
    bindings = {},
  } = options;

  const log =
    (level: LogLevel) =>
    (msg: string, fields?: LogFields): void => {
      if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
      write(formatLine(level, clock.now(), msg, bindings, fields));
    };

  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    child: (extra) =>
      createLogger({
        clock,
        level: minLevel,
        write,
        bindings: { ...bindings, ...extra },
      }),
  };
}

export function parseLogLevel(
  value: string | undefined,
  fallback: LogLevel = "info",
): LogLevel {
  return value && value in LEVEL_ORDER ? (value as LogLevel) : fallback;
}
