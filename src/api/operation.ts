import { z } from "zod";
import { authorize, type AccessLevel, type CallContext } from "./caller";
import { ApiError, type ApiResult, type ErrorDetails } from "./errors";

// An operation is the one way into the service layer (docs/architecture/
// overview.md, ADR-020). It checks access, validates its input, runs the
// handler and returns an ApiResult; it never throws. The HTTP route and
// server-rendered pages call the same function, so both get the same rules.

export interface OperationDefinition<Schema extends z.ZodType, Output> {
  /** Used in logs, e.g. "bookings.create". */
  name: string;
  /** Declared here, in the definition, so a missing check is visible in review. */
  access: AccessLevel;
  input: Schema;
  handler: (input: z.output<Schema>, ctx: CallContext) => Promise<Output>;
}

export interface Operation<Output> {
  readonly operationName: string;
  readonly access: AccessLevel;
  /** `rawInput` is untrusted: it is validated against the operation's schema. */
  (rawInput: unknown, ctx: CallContext): Promise<ApiResult<Output>>;
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export function validationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    code: issue.code,
    message: issue.message,
  }));
}

export function failure(
  ctx: Pick<CallContext, "requestId">,
  code: ApiError["code"],
  message: string,
  details?: ErrorDetails,
): ApiResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      requestId: ctx.requestId,
    },
  };
}

export function defineOperation<Schema extends z.ZodType, Output>(
  definition: OperationDefinition<Schema, Output>,
): Operation<Output> {
  const run = async (
    rawInput: unknown,
    ctx: CallContext,
  ): Promise<ApiResult<Output>> => {
    try {
      const decision = authorize(definition.access, ctx.caller);
      if (decision === "unauthenticated") {
        return failure(ctx, "UNAUTHENTICATED", "Sign in to continue.");
      }
      if (decision === "forbidden") {
        return failure(ctx, "FORBIDDEN", "You do not have access to this.");
      }

      const parsed = definition.input.safeParse(rawInput);
      if (!parsed.success) {
        return failure(ctx, "VALIDATION_FAILED", "The input is not valid.", {
          issues: validationIssues(parsed.error),
        });
      }

      const data = await definition.handler(parsed.data, ctx);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof ApiError) {
        return failure(ctx, error.code, error.message, error.details);
      }
      ctx.log.error("unhandled operation error", {
        operation: definition.name,
        err: error,
      });
      // Never leak internals to the caller.
      return failure(ctx, "INTERNAL", "Something went wrong.");
    }
  };

  return Object.assign(run, {
    operationName: definition.name,
    access: definition.access,
  });
}
