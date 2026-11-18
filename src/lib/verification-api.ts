// The browser side of phone verification: the two JSON calls the code step
// makes. Every answer uses the API envelope (ADR-026), so a failure always has
// a stable code the UI can translate.

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

export interface CodeRequestResult {
  phone: string;
  channel: "whatsapp" | "sms";
  expiresAt: string;
  resendAt: string;
}

export interface CodeCheckResult {
  token: string;
  phone: string;
  expiresAt: string;
  tokenMinutes: number;
}

async function post<T>(url: string, body: unknown): Promise<ApiEnvelope<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}

export function requestVerificationCode(
  phone: string,
  locale: "ar" | "en",
): Promise<ApiEnvelope<CodeRequestResult>> {
  return post("/api/v1/verification/request", { phone, locale });
}

export function checkVerificationCode(
  phone: string,
  code: string,
): Promise<ApiEnvelope<CodeCheckResult>> {
  return post("/api/v1/verification/check", { phone, code });
}
