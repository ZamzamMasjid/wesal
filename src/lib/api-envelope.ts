// The envelope every API answer uses (ADR-026). Shared by the browser-side
// clients so a failure always has one shape and one stable code.

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}
