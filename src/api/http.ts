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
   * `cache-control` for the answer. Defaults to `no-store`; a public read whose
   * staleness is harmless (the availability poll, ADR-014) may opt into a short
   * shared cache.
   */
  cacheControl?: string;
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
  cacheControl = "no-store",
): Response {
  const status = result.ok ? successStatus : statusForCode(result.error.code);
  return Response.json(result, {
    status,
    headers: {
      "x-request-id": requestId,
      "cache-control": cacheControl,
    },
  });
}

/** What a file-returning operation answers with. */
export interface FileAnswer {
  bytes: Uint8Array;
  contentType: string;
  fileName?: string;
  cacheControl?: string;
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
        createCallContext(caller, { requestId, ip: clientIp(request) }),
      );
      return respond(
        result,
        requestId,
        options.successStatus,
        options.cacheControl,
      );
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

/**
 * Wraps a file-returning operation as a Next.js route handler. Access is still
 * decided inside the operation (ADR-020); the wrapper only writes the bytes for
 * a successful answer and the usual envelope for a failure. Files are never
 * stored publicly, so an answer is private and cannot be cached (ADR-013).
 */
export function fileRoute<Output extends FileAnswer>(
  operation: Operation<Output>,
  options: { successStatus?: number } = {},
) {
  return async (
    request: Request,
    context?: RouteContextLike,
  ): Promise<Response> => {
    const requestId = crypto.randomUUID();
    try {
      const params = (await context?.params) ?? {};
      const raw = await defaultInput(request, params);
      const caller = await resolveCaller(request);
      const result = await operation(
        raw,
        createCallContext(caller, { requestId, ip: clientIp(request) }),
      );
      if (!result.ok) return respond(result, requestId);

      const { bytes, contentType, fileName, cacheControl } = result.data;
      // A fresh ArrayBuffer keeps the DOM types happy and the caller's buffer
      // (which may be a pooled Node Buffer) out of the response.
      const body = new Uint8Array(bytes.byteLength);
      body.set(bytes);
      return new Response(body.buffer, {
        status: options.successStatus ?? 200,
        headers: {
          "content-type": contentType,
          "content-length": String(bytes.byteLength),
          "content-disposition": `inline; filename="${fileName ?? "file"}"`,
          "cache-control": cacheControl ?? "private, no-store",
          "x-content-type-options": "nosniff",
          "x-request-id": requestId,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        return respond(
          failure({ requestId }, error.code, error.message, error.details),
          requestId,
        );
      }
      runtime.logger.child({ requestId }).error("unhandled file route error", {
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

/**
 * The caller's address. Fly sets `fly-client-ip`; behind another proxy the first
 * `x-forwarded-for` entry is the client. Undefined when neither is present, so a
 * per-IP limit is skipped rather than applied to every caller as one.
 */
export function clientIp(request: Request): string | undefined {
  const fly = request.headers.get("fly-client-ip")?.trim();
  if (fly) return fly;
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || undefined;
}
