// The registry of every error code the API can return. Each code has one fixed
// HTTP status. Codes are stable: clients (the web UI, later the mobile app) map
// them to bilingual messages, so a code is never renamed or reused. To add a
// code, add it here; nothing else needs to change.
export const ERROR_STATUS = {
  // Generic
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,

  // Staff access
  USERNAME_TAKEN: 409,
  LAST_OWNER: 409,

  // Slot schedule: the edit would remove or change a slot that has an active
  // booking. `details.bookings` lists them.
  SCHEDULE_CONFLICT: 409,

  // Booking (booking-hold, booking-management, payment-proof)
  SLOT_TAKEN: 409,
  /** The date is closed, the slot is gone, has started, or is inside the cutoff. */
  SLOT_UNAVAILABLE: 409,
  HOLD_EXPIRED: 409,
  /** This phone already has a hold that has not expired (`details.bookingId`). */
  PHONE_HOLD_EXISTS: 409,
  /** The verified-phone token is missing, expired or issued for another number. */
  PHONE_NOT_VERIFIED: 403,
  /** The occasion is unknown or no longer offered. */
  OCCASION_UNAVAILABLE: 422,
  INVALID_FILE: 422,
  FILE_TOO_LARGE: 413,

  // Phone verification
  CODE_INVALID: 422,
  CODE_EXPIRED: 422,
  TOO_MANY_ATTEMPTS: 429,
  CODE_DELIVERY_FAILED: 503,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_STATUS;

export function statusForCode(code: ErrorCode): number {
  return ERROR_STATUS[code];
}

/** Extra, serializable facts about an error (the holder of a taken slot, the venue's phone, …). */
export type ErrorDetails = Record<string, unknown>;

/**
 * Thrown by services and operation handlers to report an expected failure.
 * `message` is for developers and logs; users see the bilingual text their
 * client maps from `code`.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: ErrorDetails;

  constructor(code: ErrorCode, message?: string, details?: ErrorDetails) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

/** The envelope every operation result and every HTTP response uses. */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails;
    /** Matches the `x-request-id` header and the log lines for the call. */
    requestId: string;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
