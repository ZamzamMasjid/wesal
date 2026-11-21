import Constants from "expo-constants";

// The app's only way into the service: the same versioned JSON API the website
// uses (docs/features/customer-mobile-app). No booking rule lives here; the app
// shows the codes the operations return.

export type Locale = "ar" | "en";

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; details?: Record<string, unknown> };
}

const fallback = "http://localhost:3000";

export const API_URL = String(
  process.env.EXPO_PUBLIC_API_URL ??
    Constants.expoConfig?.extra?.apiUrl ??
    fallback,
).replace(/\/+$/, "");

export function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}

// ---------------------------------------------------------------------------
// Public content

export interface SiteContent {
  descriptionAr: string;
  descriptionEn: string;
  policyAr: string;
  policyEn: string;
  contactPhone: string;
  contactWhatsapp: string;
}

export interface MediaItem {
  id: number;
  kind: "photo" | "video";
  position: number;
  altAr: string;
  altEn: string;
  url: string;
  mimeType: string;
}

export interface Occasion {
  id: number;
  nameAr: string;
  nameEn: string;
  priceEgp: number;
  position: number;
}

export function fetchContent() {
  return request<{ content: SiteContent; media: MediaItem[] }>(
    "/api/v1/content",
  );
}

export function fetchOccasions() {
  return request<{ occasions: Occasion[] }>("/api/v1/occasions");
}

// ---------------------------------------------------------------------------
// Availability

export type SlotState =
  "free" | "awaiting_payment" | "awaiting_review" | "confirmed" | "closed";

export interface Slot {
  start: string;
  end: string;
  state: SlotState;
  action: "book" | "call" | "none";
  alert: boolean;
}

export interface AvailabilityDay {
  day: string;
  closed: boolean;
  slots: Slot[];
}

export interface Availability {
  from: string;
  to: string;
  today: string;
  refreshedAt: string;
  days: AvailabilityDay[];
}

export function fetchAvailability(from: string, to: string) {
  return request<Availability>(
    `/api/v1/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
}

// ---------------------------------------------------------------------------
// Verification and holds

export interface CodeRequest {
  phone: string;
  channel: "whatsapp" | "sms";
  resendAt: string;
}

export interface CodeCheck {
  token: string;
  phone: string;
  expiresAt: string;
}

export function requestVerificationCode(phone: string, locale: Locale) {
  return request<CodeRequest>("/api/v1/verification/request", {
    method: "POST",
    body: JSON.stringify({ phone, locale }),
  });
}

export function checkVerificationCode(phone: string, code: string) {
  return request<CodeCheck>("/api/v1/verification/check", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export interface HoldCreated {
  bookingId: string;
  linkToken: string;
  deadlineAt: string;
  priceEgp: number;
  depositEgp: number;
  urgent: boolean;
}

export interface CreateHoldInput {
  day: string;
  start: string;
  end: string;
  occasionId: number;
  name: string;
  phone: string;
  token: string;
  locale: Locale;
}

export function createHold(input: CreateHoldInput) {
  return request<HoldCreated>("/api/v1/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---------------------------------------------------------------------------
// The private booking page

export type BookingStatus =
  | "held"
  | "proof_submitted"
  | "confirmed"
  | "expired"
  | "rejected"
  | "cancelled";

export interface PublicBooking {
  bookingId: string;
  status: BookingStatus;
  occasion: { nameAr: string; nameEn: string };
  customerName: string;
  day: string;
  start: string;
  end: string;
  priceEgp: number;
  depositEgp: number;
  remainderEgp: number;
  remainderPaid: boolean;
  deadlineAt: string | null;
  transfer: {
    vodafoneCashNumber: string | null;
    instapayAddress: string | null;
  } | null;
  createdAt: string;
  refreshedAt: string;
}

export function fetchBooking(token: string) {
  return request<PublicBooking>(
    `/api/v1/bookings/by-token/${encodeURIComponent(token)}`,
  );
}

export function lookupBooking(bookingId: string) {
  return request<{ bookingId: string; token: string }>(
    `/api/v1/bookings/lookup?bookingId=${encodeURIComponent(bookingId)}`,
  );
}

export interface PickedImage {
  uri: string;
  mimeType: string;
  fileName: string;
}

export async function uploadProof(
  token: string,
  image: PickedImage,
): Promise<ApiEnvelope<{ id: number }>> {
  try {
    const form = new FormData();
    // React Native accepts a file descriptor object here.
    form.append("file", {
      uri: image.uri,
      name: image.fileName,
      type: image.mimeType,
    } as unknown as Blob);
    const response = await fetch(
      `${API_URL}/api/v1/bookings/by-token/${encodeURIComponent(token)}/proof`,
      { method: "POST", body: form, headers: { accept: "application/json" } },
    );
    return (await response.json()) as ApiEnvelope<{ id: number }>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}

// ---------------------------------------------------------------------------
// Staff session, devices and the review queue

const COOKIE_HEADERS = (cookie: string) => ({
  cookie,
  "content-type": "application/json",
});

/** Signs in and returns the session cookie Better Auth set. */
export async function signIn(
  username: string,
  password: string,
): Promise<ApiEnvelope<{ cookie: string }>> {
  try {
    const response = await fetch(`${API_URL}/api/auth/sign-in/username`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: response.status === 429 ? "RATE_LIMITED" : "UNAUTHENTICATED",
        },
      };
    }
    const raw = response.headers.get("set-cookie") ?? "";
    const cookie = raw.split(";")[0] ?? "";
    if (!cookie) return { ok: false, error: { code: "UNAUTHENTICATED" } };
    return { ok: true, data: { cookie } };
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}

export interface StaffProfile {
  id: string;
  name: string;
  role: "owner" | "staff";
}

export function staffMe(cookie: string) {
  return request<StaffProfile>("/api/v1/staff/me", {
    headers: { cookie },
  });
}

export function registerDevice(
  cookie: string,
  token: string,
  platform: "android" | "ios",
) {
  return request<{ id: number; platform: string }>("/api/v1/staff/devices", {
    method: "POST",
    headers: COOKIE_HEADERS(cookie),
    body: JSON.stringify({ token, platform }),
  });
}

export function unregisterDevice(cookie: string, id: number) {
  return request<{ unregistered: boolean }>(`/api/v1/staff/devices/${id}`, {
    method: "DELETE",
    headers: { cookie },
  });
}

export interface ReviewQueueItem {
  bookingId: string;
  status: "held" | "proof_submitted";
  customerName: string;
  day: string;
  start: string;
  end: string;
  occasion: { nameAr: string; nameEn: string };
  waitingSince: string;
}

export function fetchReviewQueue(cookie: string) {
  return request<{ items: ReviewQueueItem[]; refreshedAt: string }>(
    "/api/v1/staff/review-queue",
    { headers: { cookie } },
  );
}
