import { asc } from "drizzle-orm";

import type { Database } from "@/db/client";
import { mediaAsset } from "@/db/schema";
import type { MediaKind } from "@/storage/media";

// The ordered media list shared by the public content answer and the editor, so
// both read the same shape and the gallery order can never drift between them.

export interface MediaItem {
  id: number;
  kind: MediaKind;
  position: number;
  altAr: string;
  altEn: string;
  /** The public file endpoint for this asset. */
  url: string;
  mimeType: string;
  byteSize: number;
}

export function mediaUrl(id: number): string {
  return `/api/v1/media/${id}`;
}

type Reader = Pick<Database, "select">;

/** Every media asset, in gallery order. */
export async function listMedia(db: Reader): Promise<MediaItem[]> {
  const rows = await db
    .select({
      id: mediaAsset.id,
      kind: mediaAsset.kind,
      position: mediaAsset.position,
      altAr: mediaAsset.altAr,
      altEn: mediaAsset.altEn,
      mimeType: mediaAsset.mimeType,
      byteSize: mediaAsset.byteSize,
    })
    .from(mediaAsset)
    .orderBy(asc(mediaAsset.position), asc(mediaAsset.id));

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    position: row.position,
    altAr: row.altAr,
    altEn: row.altEn,
    url: mediaUrl(row.id),
    mimeType: row.mimeType,
    byteSize: Number(row.byteSize),
  }));
}
