import type { ApiEnvelope } from "./api-envelope";

// The browser side of content management (docs/features/content-management).
// Only the owner may reach the staff endpoints; the server decides, never the
// page. The media list and text are loaded through the owner-only operations so
// the editor never depends on the public content answer.

export interface SiteTexts {
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
  byteSize: number;
}

export interface MediaLimits {
  maxPhotoMb: number;
  maxVideoMb: number;
}

export interface DiskSpace {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

export interface StaffContent {
  content: SiteTexts;
  media: MediaItem[];
}

export interface MediaLibrary {
  media: MediaItem[];
  limits: MediaLimits;
  disk: DiskSpace;
}

export const CONTENT_KEYS = [
  "description",
  "policy",
  "contact_phone",
  "contact_whatsapp",
] as const;

export type ContentKey = (typeof CONTENT_KEYS)[number];

/** The update payload: contact numbers travel in the Arabic field, as stored. */
export function contentEntries(
  texts: SiteTexts,
): { key: ContentKey; valueAr: string; valueEn: string }[] {
  return [
    {
      key: "description",
      valueAr: texts.descriptionAr,
      valueEn: texts.descriptionEn,
    },
    { key: "policy", valueAr: texts.policyAr, valueEn: texts.policyEn },
    {
      key: "contact_phone",
      valueAr: texts.contactPhone,
      valueEn: texts.contactPhone,
    },
    {
      key: "contact_whatsapp",
      valueAr: texts.contactWhatsapp,
      valueEn: texts.contactWhatsapp,
    },
  ];
}

/** The alternative text for a language, falling back to Arabic (spec edge case). */
export function mediaAlt(item: MediaItem, locale: "ar" | "en"): string {
  if (locale === "ar") return item.altAr;
  return item.altEn.trim() === "" ? item.altAr : item.altEn;
}

/** A new order after moving an item by `delta` places; unchanged when it cannot move. */
export function moveMedia(
  media: MediaItem[],
  id: number,
  delta: number,
): MediaItem[] {
  const index = media.findIndex((item) => item.id === id);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= media.length) return media;
  const next = [...media];
  const [item] = next.splice(index, 1);
  if (!item) return media;
  next.splice(target, 0, item);
  return next;
}

/** The positions to persist after a reorder: only the rows whose position changed. */
export function positionChanges(
  before: MediaItem[],
  after: MediaItem[],
): { id: number; position: number }[] {
  const previous = new Map(before.map((item) => [item.id, item.position]));
  return after
    .map((item, position) => ({ id: item.id, position }))
    .filter((entry) => previous.get(entry.id) !== entry.position);
}

export const ACCEPTED_MEDIA = "image/*,video/*";

/**
 * Checks a file against the same rule the server enforces, so the editor can
 * say what is wrong before the bytes are sent. Returns a message key.
 */
export function uploadProblem(
  file: { type: string; name: string; size: number },
  limits: MediaLimits,
): "wrongType" | "tooLarge" | null {
  const mime = file.type.trim().toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage =
    mime.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension);
  const isVideo =
    mime.startsWith("video/") ||
    ["mp4", "webm", "mov", "ogv"].includes(extension);
  if (!isImage && !isVideo) return "wrongType";
  const maxMb = isVideo ? limits.maxVideoMb : limits.maxPhotoMb;
  if (file.size > maxMb * 1024 * 1024) return "tooLarge";
  return null;
}

/** A short, localized size for the disk meter and upload rows. */
export function formatBytes(bytes: number, locale: "ar" | "en"): string {
  const units =
    locale === "ar"
      ? ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت", "تيرابايت"]
      : ["B", "KB", "MB", "GB", "TB"];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const formatted = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0,
  }).format(value);
  return `${formatted} ${units[unit]}`;
}

function networkFailure<T>(): ApiEnvelope<T> {
  return { ok: false, error: { code: "NETWORK" } };
}

async function call<T>(
  url: string,
  method: "GET" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<ApiEnvelope<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body
        ? { "content-type": "application/json" }
        : { accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return networkFailure<T>();
  }
}

export function fetchStaffContent(): Promise<ApiEnvelope<StaffContent>> {
  return call<StaffContent>("/api/v1/staff/content", "GET");
}

export function saveSiteContent(
  texts: SiteTexts,
): Promise<ApiEnvelope<StaffContent>> {
  return call<StaffContent>("/api/v1/staff/content", "PUT", {
    entries: contentEntries(texts),
  });
}

export function fetchMediaLibrary(): Promise<ApiEnvelope<MediaLibrary>> {
  return call<MediaLibrary>("/api/v1/staff/media", "GET");
}

/**
 * Uploads one file with a determinate progress bar. `fetch` cannot report upload
 * progress, so this one call uses XMLHttpRequest.
 */
export function uploadMedia(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ApiEnvelope<MediaItem>> {
  return new Promise((resolve) => {
    const form = new FormData();
    form.append("file", file);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/v1/staff/media");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      const parsed = request.response as ApiEnvelope<MediaItem> | null;
      resolve(parsed ?? networkFailure<MediaItem>());
    };
    request.onerror = () => resolve(networkFailure<MediaItem>());
    request.onabort = () => resolve(networkFailure<MediaItem>());
    request.send(form);
  });
}

export function updateMedia(
  id: number,
  patch: { altAr?: string; altEn?: string; position?: number },
): Promise<ApiEnvelope<MediaItem>> {
  return call<MediaItem>(
    `/api/v1/staff/media/${encodeURIComponent(String(id))}`,
    "PATCH",
    patch,
  );
}

export function deleteMedia(id: number): Promise<ApiEnvelope<{ id: number }>> {
  return call<{ id: number }>(
    `/api/v1/staff/media/${encodeURIComponent(String(id))}`,
    "DELETE",
  );
}
