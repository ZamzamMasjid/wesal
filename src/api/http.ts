import { runtime } from "@/lib/runtime";
import { resolveCaller } from "./caller";
import { createCallContext } from "./context";
import { ApiError, statusForCode, type ApiResult } from "./errors";
import { failure, type Operation } from "./operation";

// The HTTP wrapper: turns a Request into operation input, calls the operation,
// and writes the envelope. It holds no authorization or business logic (ADR-020).

type RouteParams = Record<string, string | string[] | undefined>;
export interface RouteContextLike {
  params: Promise<RouteParams>;
}

export interface RouteOptions {
  /** Status for a successful result. Default 200; use 201 for creates. */
  successStatus?: number;
  /**
   * Builds the operation's raw input from the request. The default reads the
   * query string (GET, HEAD, DELETE) or a JSON body (other methods), merged with
   * the path parameters. Replace it for multipart uploads.
   */
  input?: (request: Request, params: RouteParams) => Promise<unknown> | unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function defaultInput(
  request: Request,
  params: RouteParams,
): Promise<Record<string, unknown>> {
  const method = request.method.toUpperCase();
  let fromRequest: Record<string, unknown> = {};

  if (method === "GET" || method === "HEAD" || method === "DELETE") {
    const query = new URL(request.url).searchParams;
    for (const key of new Set(query.keys())) {
      const values = query.getAll(key);
      fromRequest[key] = values.length > 1 ? values : values[0];
    }
  } else {
    const text = await request.text();
    if (text.trim() !== "") {
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new ApiError("VALIDATION_FAILED", "The body is not valid JSON.", {
          issues: [{ path: "", code: "invalid_json", message: "Invalid JSON" }],
        });
      }
      if (!isPlainObject(body)) {
        throw new ApiError("VALIDATION_FAILED", "The body must be an object.", {
          issues: [
            { path: "", code: "invalid_type", message: "Expected an object" },
          ],
        });
      }
      fromRequest = body;
    }
  }

  // Path parameters win over anything the caller put in the query or body.
  return { ...fromRequest, ...params };
}

export function respond<T>(
  result: ApiResult<T>,
  requestId: string,
  successStatus = 200,
): Response {
  const status = result.ok ? successStatus : statusForCode(result.error.code);
  return Response.json(result, {
    status,
    headers: {
      "x-request-id": requestId,
      // API answers are per-caller and polled for freshness (ADR-014).
      "cache-control": "no-store",
    },
  });
}

/** Wraps an operation as a Next.js route handler. */
export function route<Output>(
  operation: Operation<Output>,
  options: RouteOptions = {},
) {
  return async (
    request: Request,
    context?: RouteContextLike,
  ): Promise<Response> => {
    // Generated here, never taken from the client, so log lines cannot be forged.
    const requestId = crypto.randomUUID();
    try {
      const params = (await context?.params) ?? {};
      const raw = await (options.input ?? defaultInput)(request, params);
      const caller = await resolveCaller(request);
      const result = await operation(
        raw,
        createCallContext(caller, { requestId }),
      );
      return respond(result, requestId, options.successStatus);
    } catch (error) {
      // Input building failed (bad JSON, bad multipart) or something unexpected.
      if (error instanceof ApiError) {
        return respond(
          failure({ requestId }, error.code, error.message, error.details),
          requestId,
        );
      }
      runtime.logger.child({ requestId }).error("unhandled route error", {
        operation: operation.operationName,
        err: error,
      });
      return respond(
        failure({ requestId }, "INTERNAL", "Something went wrong."),
        requestId,
      );
    }
  };
}

/** The envelope answer for a path under /api/v1 that no route handles. */
export function apiNotFound(): Response {
  const requestId = crypto.randomUUID();
  return respond(
    failure({ requestId }, "NOT_FOUND", "No such endpoint."),
    requestId,
  );
}
