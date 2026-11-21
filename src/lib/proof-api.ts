import type { ApiEnvelope } from "./api-envelope";

// The browser side of the proof upload (docs/features/payment-proof). Shared
// constant with the server: only these image types are accepted, checked from
// content on the server; the browser uses them to filter the gallery and to
// explain a refusal before spending mobile data.

/** A phone screenshot is rarely larger than this; ten megabytes is generous. */
export const MAX_PROOF_BYTES = 10 * 1024 * 1024;

export const PROOF_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProofMime = (typeof PROOF_MIME_TYPES)[number];

/** The `accept` attribute of the file input. A hint only; the server decides. */
export const PROOF_ACCEPT = PROOF_MIME_TYPES.join(",");

export interface ProofUploaded {
  status: "proof_submitted";
  proofId: number;
  uploadedAt: string;
}

/** Whether the browser's guess at the file type is one we accept. */
export function looksLikeProof(file: { type: string }): boolean {
  return (PROOF_MIME_TYPES as readonly string[]).includes(file.type);
}

export function proofEndpoint(token: string): string {
  return `/api/v1/bookings/by-token/${encodeURIComponent(token)}/proof`;
}

/** A file size as a person reads it, with Western digits in both languages. */
export function proofSizeLabel(bytes: number, locale: "ar" | "en"): string {
  const tag = locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB";
  if (bytes >= 1024 * 1024) {
    return `${new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
  }
  return `${new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

const networkFailure = (): ApiEnvelope<never> => ({
  ok: false,
  error: { code: "NETWORK" },
});

function envelopeFrom(body: unknown): ApiEnvelope<ProofUploaded> {
  if (body && typeof body === "object" && "ok" in body) {
    return body as ApiEnvelope<ProofUploaded>;
  }
  return networkFailure();
}

async function uploadWithFetch(
  token: string,
  file: Blob,
): Promise<ApiEnvelope<ProofUploaded>> {
  try {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(proofEndpoint(token), {
      method: "POST",
      body: form,
    });
    return envelopeFrom(await response.json());
  } catch {
    return networkFailure();
  }
}

/**
 * Sends one screenshot, reporting how much of it has left the phone. Uses
 * XMLHttpRequest because fetch cannot report upload progress; a browser without
 * it still uploads, just without a progress figure.
 */
export function uploadProof(
  token: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<ApiEnvelope<ProofUploaded>> {
  if (typeof XMLHttpRequest === "undefined") {
    return uploadWithFetch(token, file);
  }

  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", proofEndpoint(token));
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(1, event.loaded / event.total));
      }
    };
    request.onload = () => {
      // Some browsers ignore `responseType` for multipart answers and leave the
      // parsed body empty; fall back to parsing the text by hand.
      if (request.response && typeof request.response === "object") {
        resolve(envelopeFrom(request.response));
        return;
      }
      try {
        resolve(envelopeFrom(JSON.parse(request.responseText)));
      } catch {
        resolve(networkFailure());
      }
    };
    request.onerror = () => resolve(networkFailure());
    request.onabort = () => resolve(networkFailure());

    const form = new FormData();
    form.append("file", file);
    request.send(form);
  });
}
