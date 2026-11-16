import { ApiError } from "@/api/errors";

// Reads a form-encoded webhook body into the plain parameters Twilio signs.
// The body is read before the signature is checked, so its size is capped: a
// real status callback is well under a kilobyte.

export const MAX_WEBHOOK_BODY_BYTES = 16 * 1024;

export async function readFormParams(
  request: Request,
  maxBytes = MAX_WEBHOOK_BODY_BYTES,
): Promise<Record<string, string>> {
  const tooLarge = () =>
    new ApiError("VALIDATION_FAILED", "The body is too large.");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw tooLarge();

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");

  const params: Record<string, string> = {};
  new URLSearchParams(text).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}
