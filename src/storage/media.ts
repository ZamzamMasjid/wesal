import { randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat, statfs, unlink, writeFile } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

// Venue media on the upload volume (docs/features/content-management,
// docs/architecture/overview.md). Only the service layer under `ops/` reads or
// writes here. Files live in `media/` and the database stores a path relative to
// `UPLOAD_DIR`, never an absolute one. Venue media persists; the one-day purge
// applies only to payment screenshots.

/** The directory under `UPLOAD_DIR` that holds venue photos and videos. */
export const MEDIA_FOLDER = "media";

export type MediaKind = "photo" | "video";

interface MediaType {
  kind: MediaKind;
  extension: string;
  mimeType: string;
}

/**
 * The formats the editor accepts. Anything else is refused before a byte is
 * written, so the gallery never has to deal with an unknown file.
 */
const MEDIA_TYPES: Record<string, MediaType> = {
  "image/jpeg": { kind: "photo", extension: "jpg", mimeType: "image/jpeg" },
  "image/png": { kind: "photo", extension: "png", mimeType: "image/png" },
  "image/webp": { kind: "photo", extension: "webp", mimeType: "image/webp" },
  "image/gif": { kind: "photo", extension: "gif", mimeType: "image/gif" },
  "image/avif": { kind: "photo", extension: "avif", mimeType: "image/avif" },
  "video/mp4": { kind: "video", extension: "mp4", mimeType: "video/mp4" },
  "video/webm": { kind: "video", extension: "webm", mimeType: "video/webm" },
  "video/quicktime": {
    kind: "video",
    extension: "mov",
    mimeType: "video/quicktime",
  },
  "video/ogg": { kind: "video", extension: "ogv", mimeType: "video/ogg" },
};

const EXTENSION_TYPES: Record<string, MediaType> = {
  jpg: { kind: "photo", extension: "jpg", mimeType: "image/jpeg" },
  jpeg: { kind: "photo", extension: "jpg", mimeType: "image/jpeg" },
  png: { kind: "photo", extension: "png", mimeType: "image/png" },
  webp: { kind: "photo", extension: "webp", mimeType: "image/webp" },
  gif: { kind: "photo", extension: "gif", mimeType: "image/gif" },
  avif: { kind: "photo", extension: "avif", mimeType: "image/avif" },
  mp4: { kind: "video", extension: "mp4", mimeType: "video/mp4" },
  webm: { kind: "video", extension: "webm", mimeType: "video/webm" },
  mov: { kind: "video", extension: "mov", mimeType: "video/quicktime" },
  ogv: { kind: "video", extension: "ogv", mimeType: "video/ogg" },
};

function extensionOf(name: string): string {
  return path.extname(name).replace(/^\./, "").toLowerCase();
}

/**
 * Works out what a browser sent. The declared MIME type is preferred; some
 * browsers leave it empty for a video, so the file extension is the fallback.
 */
export function classifyMedia(
  mimeType: string,
  fileName = "",
): MediaType | null {
  const mime = mimeType.trim().toLowerCase();
  const byExtension = EXTENSION_TYPES[extensionOf(fileName)];
  const byMime = MEDIA_TYPES[mime];
  if (byMime) {
    // A supported MIME type wins, unless the extension claims another kind:
    // an image/png named .mp4 would play as a broken video in the gallery.
    if (byExtension && byExtension.kind !== byMime.kind) return null;
    return byMime;
  }
  if (!byExtension) return null;
  // A declared type that contradicts the extension is a lie worth refusing.
  if (mime !== "" && !mime.startsWith(`${byExtension.kind}/`)) return null;
  return byExtension;
}

/** A stored media path is only ever one we wrote: `media/<name>.<ext>`. */
const RELATIVE_MEDIA_PATH = /^media\/[A-Za-z0-9_-]+\.[a-z0-9]+$/;

/** Resolves a stored media path against the volume root, refusing anything else. */
export function resolveMediaPath(root: string, relative: string): string {
  if (!RELATIVE_MEDIA_PATH.test(relative)) {
    throw new Error(`Refusing to use an unexpected media path: ${relative}`);
  }
  return path.join(root, relative);
}

export interface StoredMedia {
  /** Relative to `UPLOAD_DIR`, e.g. "media/0abc-1def.mp4". */
  filePath: string;
  byteSize: number;
}

function mediaName(extension: string, now: Date): string {
  return `${now.getTime().toString(36)}-${randomBytes(8).toString("hex")}.${extension}`;
}

/**
 * Writes a stream to a fresh random name and returns its relative path. The name
 * carries nothing about the venue or the owner. `onBytes` sees the size as it is
 * written, so a caller can abort once the limit is passed.
 */
export async function writeMedia(
  root: string,
  stream: ReadableStream<Uint8Array>,
  extension: string,
  now: Date,
  onBytes?: (written: number) => void,
): Promise<StoredMedia> {
  const filePath = `${MEDIA_FOLDER}/${mediaName(extension, now)}`;
  const absolute = resolveMediaPath(root, filePath);
  await mkdir(path.dirname(absolute), { recursive: true });

  let written = 0;
  const source = Readable.fromWeb(
    stream as Parameters<typeof Readable.fromWeb>[0],
  );
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      written += chunk.byteLength;
      onBytes?.(written);
      callback(null, chunk);
    },
  });
  await pipeline(source, counter, createWriteStream(absolute));
  return { filePath, byteSize: written };
}

/** Writes bytes directly; used by tests and small callers. */
export async function writeMediaBytes(
  root: string,
  data: Uint8Array,
  extension: string,
  now: Date,
): Promise<StoredMedia> {
  const filePath = `${MEDIA_FOLDER}/${mediaName(extension, now)}`;
  const absolute = resolveMediaPath(root, filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, data);
  return { filePath, byteSize: data.byteLength };
}

export async function statMedia(
  root: string,
  relative: string,
): Promise<{ size: number }> {
  const info = await stat(resolveMediaPath(root, relative));
  return { size: info.size };
}

/** Deletes a media file. A file that is already gone is treated as deleted. */
export async function deleteMedia(
  root: string,
  relative: string,
): Promise<void> {
  try {
    await unlink(resolveMediaPath(root, relative));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}

export interface DiskSpace {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

/** How much room the volume has; the editor shows what is left. */
export async function diskSpace(root: string): Promise<DiskSpace> {
  await mkdir(root, { recursive: true });
  const info = await statfs(root);
  const blockSize = info.bsize;
  const totalBytes = info.blocks * blockSize;
  const freeBytes = info.bavail * blockSize;
  const usedBytes = (info.blocks - info.bfree) * blockSize;
  return { totalBytes, usedBytes, freeBytes };
}

/** Opens a media file for streaming. The caller owns the returned stream. */
export function openMediaStream(
  root: string,
  relative: string,
  range?: { start: number; end: number },
) {
  return createReadStream(resolveMediaPath(root, relative), range);
}

/** Removes a directory tree; used by tests that own a temporary volume. */
export async function removeVolume(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}
