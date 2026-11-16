import { runtime, type Runtime } from "@/lib/runtime";
import type { CallContext, Caller } from "./caller";

export interface CreateCallContextOptions {
  /** Defaults to a new id. */
  requestId?: string;
  /** Defaults to the production runtime; tests pass a fake clock and logger. */
  deps?: Runtime;
}

/**
 * The context an operation runs with. The HTTP route builds one per request;
 * server-rendered pages build one when they call an operation in-process
 * (ADR-020), so both paths log and read time the same way.
 */
export function createCallContext(
  caller: Caller,
  options: CreateCallContextOptions = {},
): CallContext {
  const { requestId = crypto.randomUUID(), deps = runtime } = options;
  return {
    caller,
    requestId,
    clock: deps.clock,
    log: deps.logger.child({ requestId }),
  };
}
