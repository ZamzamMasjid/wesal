import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { recordAudit } from "@/audit/audit";
import type { Caller } from "@/api/caller";
import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { mediaAsset } from "@/db/schema";
import { uploadRoot } from "@/storage/proofs";
import {
  classifyMedia,
  deleteMedia,
  diskSpace,
  resolveMediaPath,
  writeMedia,
  type DiskSpace,
} from "@/storage/media";
import { loadSettings } from "@/ops/venue/settings";

import { listMedia, mediaUrl, type MediaItem } from "./media-list";

// Venue photo and video operations (docs/features/content-management). The
// owner uploads, reorders, describes and removes media; anyone may read a file
// through its id. Files live on the upload volume under `media/`, never in
// public/, so every read passes through the service layer.

export interface MediaDeps {
  db: Database;
  /** The volume root; a test points this at a temporary directory. */
  root: string;
}

/** What the file route needs to stream an asset. Never serialized to a client. */
export interface MediaFile {
  /** Absolute path on the volume. */
  filePath: string;
  contentType: string;
  byteSize: number;
  etag: string;
}

export interface MediaList {
  media: MediaItem[];
  limits: { maxPhotoMb: number; maxVideoMb: number };
  disk: DiskSpace;
}

const idInput = z.coerce.number().int().positive();

/** The multipart form as the route builds it, before validation. */
const uploadInput = z.object({
  file: z.custom<File>(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      typeof (value as File).arrayBuffer === "function" &&
      typeof (value as File).size === "number" &&
      typeof (value as File).type === "string",
    { message: "Choose a file to upload." },
  ),
  altAr: z.string().trim().max(500).default(""),
  altEn: z.string().trim().max(500).default(""),
});

const altText = z.string().trim().max(500);
const position = z.number().int().min(0).max(10_000);

function actorId(caller: Caller): string {
  if (caller.kind !== "staff") throw new ApiError("UNAUTHENTICATED");
  return caller.userId;
}

function itemOf(row: {
  id: number;
  kind: "photo" | "video";
  position: number;
  altAr: string;
  altEn: string;
  mimeType: string;
  byteSize: number;
}): MediaItem {
  return {
    id: row.id,
    kind: row.kind,
    position: row.position,
    altAr: row.altAr,
    altEn: row.altEn,
    url: mediaUrl(row.id),
    mimeType: row.mimeType,
    byteSize: Number(row.byteSize),
  };
}

export function createMediaOperations(resolve: () => MediaDeps) {
  const read = defineOperation({
    name: "media.read",
    access: "anonymous",
    input: z.object({ id: idInput }),
    handler: async ({ id }): Promise<MediaFile> => {
      const { db, root } = resolve();
      const [row] = await db
        .select({
          id: mediaAsset.id,
          filePath: mediaAsset.filePath,
          mimeType: mediaAsset.mimeType,
          byteSize: mediaAsset.byteSize,
        })
        .from(mediaAsset)
        .where(eq(mediaAsset.id, id));
      if (!row) throw new ApiError("NOT_FOUND", "No such media.");
      return {
        filePath: resolveMediaPath(root, row.filePath),
        contentType: row.mimeType,
        byteSize: Number(row.byteSize),
        etag: `"${row.id}-${row.byteSize}"`,
      };
    },
  });

  const list = defineOperation({
    name: "staff.media.list",
    access: "owner",
    input: z.object({}),
    handler: async (): Promise<MediaList> => {
      const { db, root } = resolve();
      const [media, settings, disk] = await Promise.all([
        listMedia(db),
        loadSettings(db),
        diskSpace(root),
      ]);
      return {
        media,
        limits: {
          maxPhotoMb: settings.maxPhotoMb,
          maxVideoMb: settings.maxVideoMb,
        },
        disk,
      };
    },
  });

  const upload = defineOperation({
    name: "staff.media.upload",
    access: "owner",
    input: uploadInput,
    handler: async ({ file, altAr, altEn }, ctx): Promise<MediaItem> => {
      const { db, root } = resolve();
      const actor = actorId(ctx.caller);
      const kind = classifyMedia(file.type, file.name);
      if (!kind) {
        throw new ApiError(
          "INVALID_FILE",
          "Choose a JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV or OGG file.",
        );
      }

      const settings = await loadSettings(db);
      const maxMb =
        kind.kind === "photo" ? settings.maxPhotoMb : settings.maxVideoMb;
      const limitBytes = maxMb * 1024 * 1024;
      if (file.size > limitBytes) {
        throw new ApiError("FILE_TOO_LARGE", "The file is too large.", {
          kind: kind.kind,
          maxMb,
        });
      }

      const disk = await diskSpace(root);
      if (disk.freeBytes < file.size + 16 * 1024 * 1024) {
        throw new ApiError(
          "STORAGE_FULL",
          "The volume is running out of room.",
          {
            freeBytes: disk.freeBytes,
          },
        );
      }

      const now = ctx.clock.now();
      const stored = await writeMedia(root, file.stream(), kind.extension, now);

      // The browser-reported size is a hint; the bytes actually written decide.
      if (stored.byteSize > limitBytes) {
        await deleteMedia(root, stored.filePath).catch(() => undefined);
        throw new ApiError("FILE_TOO_LARGE", "The file is too large.", {
          kind: kind.kind,
          maxMb,
        });
      }

      try {
        return await db.transaction(async (tx) => {
          const [next] = await tx
            .select({
              position: sql<number>`coalesce(max(${mediaAsset.position}), -1) + 1`,
            })
            .from(mediaAsset);
          const [created] = await tx
            .insert(mediaAsset)
            .values({
              kind: kind.kind,
              filePath: stored.filePath,
              mimeType: kind.mimeType,
              byteSize: stored.byteSize,
              altAr,
              altEn,
              position: Number(next?.position ?? 0),
              createdAt: now,
              updatedAt: now,
            })
            .returning({
              id: mediaAsset.id,
              kind: mediaAsset.kind,
              position: mediaAsset.position,
              altAr: mediaAsset.altAr,
              altEn: mediaAsset.altEn,
              mimeType: mediaAsset.mimeType,
              byteSize: mediaAsset.byteSize,
            });
          if (!created) throw new ApiError("INTERNAL");
          await recordAudit(tx, ctx.clock, {
            actorId: actor,
            action: "media.create",
            target: `media:${created.id}`,
            detail: {
              kind: created.kind,
              byteSize: created.byteSize,
              altAr: created.altAr,
              altEn: created.altEn,
            },
          });
          return itemOf(created);
        });
      } catch (error) {
        // The row is the source of truth; a file without one is garbage.
        await deleteMedia(root, stored.filePath).catch(() => undefined);
        throw error;
      }
    },
  });

  const update = defineOperation({
    name: "staff.media.update",
    access: "owner",
    input: z
      .object({
        id: idInput,
        altAr: altText.optional(),
        altEn: altText.optional(),
        position: position.optional(),
      })
      .refine(
        (value) =>
          value.altAr !== undefined ||
          value.altEn !== undefined ||
          value.position !== undefined,
        { message: "Nothing to change." },
      ),
    handler: async (input, ctx): Promise<MediaItem> => {
      const { db } = resolve();
      const actor = actorId(ctx.caller);
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(mediaAsset)
          .where(eq(mediaAsset.id, input.id))
          .for("update");
        if (!current) throw new ApiError("NOT_FOUND", "No such media.");

        const detail: Record<string, unknown> = {};
        const changes: Partial<typeof mediaAsset.$inferInsert> = {};
        if (input.altAr !== undefined && input.altAr !== current.altAr) {
          changes.altAr = input.altAr;
          detail.altAr = { from: current.altAr, to: input.altAr };
        }
        if (input.altEn !== undefined && input.altEn !== current.altEn) {
          changes.altEn = input.altEn;
          detail.altEn = { from: current.altEn, to: input.altEn };
        }
        if (
          input.position !== undefined &&
          input.position !== current.position
        ) {
          changes.position = input.position;
          detail.position = { from: current.position, to: input.position };
        }

        if (Object.keys(changes).length > 0) {
          await tx
            .update(mediaAsset)
            .set({ ...changes, updatedAt: ctx.clock.now() })
            .where(eq(mediaAsset.id, current.id));
          await recordAudit(tx, ctx.clock, {
            actorId: actor,
            action: "media.update",
            target: `media:${current.id}`,
            detail,
          });
        }

        const [updated] = await tx
          .select()
          .from(mediaAsset)
          .where(eq(mediaAsset.id, current.id));
        if (!updated) throw new ApiError("NOT_FOUND");
        return itemOf(updated);
      });
    },
  });

  const remove = defineOperation({
    name: "staff.media.delete",
    access: "owner",
    input: z.object({ id: idInput }),
    handler: async ({ id }, ctx): Promise<{ id: number }> => {
      const { db, root } = resolve();
      const actor = actorId(ctx.caller);
      const removed = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(mediaAsset)
          .where(eq(mediaAsset.id, id))
          .for("update");
        if (!current) throw new ApiError("NOT_FOUND", "No such media.");
        await tx.delete(mediaAsset).where(eq(mediaAsset.id, current.id));
        await recordAudit(tx, ctx.clock, {
          actorId: actor,
          action: "media.delete",
          target: `media:${current.id}`,
          detail: { kind: current.kind, filePath: current.filePath },
        });
        return current;
      });
      // There is no recycle bin (content-management spec); the row is gone, so
      // the file is removed and a failure is logged rather than resurrected.
      await deleteMedia(root, removed.filePath).catch((error) => {
        ctx.log.error("media file could not be deleted", {
          mediaId: removed.id,
          err: error,
        });
      });
      return { id: removed.id };
    },
  });

  return { read, list, upload, update, remove };
}

export const mediaOperations = createMediaOperations(() => ({
  db: getDb(),
  root: uploadRoot(),
}));
