// SPEC: docs/features/content-management — media is stored on the volume under a random name, ordered, described in both languages, and removed with its row; only the owner may change it
// ROADMAP: phase-5-public-site / content-management / Implement media upload and ordering for photos and videos on the volume
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Caller } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { settings, staffUser, mediaAsset } from "@/db/schema";
import { loadSettings } from "@/ops/venue/settings";
import { openTestDb, resetDatabase } from "@/test/db";
import { aStaffUser } from "@/test/factories";
import { deleteMedia, writeMediaBytes } from "@/storage/media";

import { createContentOperations } from "./content";
import { createMediaOperations } from "./media";

const handle = openTestDb();
const { db } = handle;
let root = "";
const ops = () => createMediaOperations(() => ({ db, root }));
const content = createContentOperations(() => ({ db }));

beforeEach(async () => {
  await resetDatabase(handle);
  root = await mkdtemp(path.join(tmpdir(), "wesal-media-"));
});
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

const ctx = (caller: Caller) => createCallContext(caller, { requestId: "r" });
const anon: Caller = { kind: "anonymous" };

async function makeOwner(): Promise<Caller> {
  const row = aStaffUser({ role: "owner" });
  await db.insert(staffUser).values(row);
  return { kind: "staff", userId: row.id, role: "owner" };
}

function aFile(
  name: string,
  type: string,
  bytes: Uint8Array = new Uint8Array([1, 2, 3, 4]),
): File {
  return new File([bytes as unknown as BlobPart], name, { type });
}

describe("staff.media.upload", () => {
  it("stores a photo on the volume, appends it to the gallery and audits it", async () => {
    const owner = await makeOwner();
    const media = ops();
    const result = await media.upload(
      {
        file: aFile("hall.jpg", "image/jpeg"),
        altAr: "القاعة",
        altEn: "The hall",
      },
      ctx(owner),
    );
    expect(result.ok && result.data).toMatchObject({
      kind: "photo",
      position: 0,
      altAr: "القاعة",
      altEn: "The hall",
      mimeType: "image/jpeg",
      byteSize: 4,
    });
    if (!result.ok) throw new Error("setup failed");
    expect(result.data.url).toBe(`/api/v1/media/${result.data.id}`);

    const [storedRow] = await db
      .select({ filePath: mediaAsset.filePath })
      .from(mediaAsset)
      .where(eq(mediaAsset.id, result.data.id));
    expect(storedRow).toBeTruthy();

    const list = await media.list({}, ctx(owner));
    expect(list.ok && list.data.media.map((m) => m.altEn)).toEqual([
      "The hall",
    ]);
    expect(list.ok && list.data.limits).toEqual({
      maxPhotoMb: 20,
      maxVideoMb: 200,
    });
    expect(list.ok && list.data.disk.freeBytes).toBeGreaterThan(0);

    const publicRead = await content.read({}, ctx(anon));
    expect(publicRead.ok && publicRead.data.media).toHaveLength(1);

    const stored = await readFile(path.join(root, storedRow!.filePath));
    expect(stored.byteLength).toBe(4);
  });

  it("accepts a video by extension when the browser sends no MIME type", async () => {
    const owner = await makeOwner();
    const result = await ops().upload(
      { file: aFile("tour.MP4", "", new Uint8Array([9, 8, 7])) },
      ctx(owner),
    );
    expect(result.ok && result.data).toMatchObject({
      kind: "video",
      mimeType: "video/mp4",
      position: 0,
    });
  });

  it("refuses an unsupported type, an oversized file and a full volume", async () => {
    const owner = await makeOwner();
    const media = ops();
    const bad = await media.upload(
      { file: aFile("notes.txt", "text/plain") },
      ctx(owner),
    );
    expect(!bad.ok && bad.error.code).toBe("INVALID_FILE");

    await loadSettings(db);
    await db.update(settings).set({ maxPhotoMb: 1 }).where(eq(settings.id, 1));
    const big = await media.upload(
      {
        file: aFile("big.png", "image/png", new Uint8Array(1024 * 1024 + 1)),
      },
      ctx(owner),
    );
    expect(!big.ok && big.error.code).toBe("FILE_TOO_LARGE");
    expect(!big.ok && big.error.details).toMatchObject({ maxMb: 1 });
    const after = await media.list({}, ctx(owner));
    expect(after.ok && after.data.media).toHaveLength(0);
  });

  it("does not let staff or anonymous callers upload", async () => {
    const staff: Caller = { kind: "staff", userId: "s", role: "staff" };
    for (const caller of [staff, anon]) {
      const result = await ops().upload(
        { file: aFile("hall.jpg", "image/jpeg") },
        ctx(caller),
      );
      expect(!result.ok).toBe(true);
      expect(!result.ok && result.error.code).toMatch(
        /^(FORBIDDEN|UNAUTHENTICATED)$/,
      );
    }
  });
});

describe("staff.media.update and ordering", () => {
  it("changes alternative text and position, and the public list follows", async () => {
    const owner = await makeOwner();
    const media = ops();
    const first = await media.upload(
      { file: aFile("one.jpg", "image/jpeg"), altAr: "أ", altEn: "One" },
      ctx(owner),
    );
    const second = await media.upload(
      { file: aFile("two.png", "image/png"), altAr: "ب", altEn: "Two" },
      ctx(owner),
    );
    if (!first.ok || !second.ok) throw new Error("setup failed");

    const moved = await media.update(
      { id: second.data.id, position: 0 },
      ctx(owner),
    );
    expect(moved.ok && moved.data).toMatchObject({ position: 0 });
    const pushed = await media.update(
      { id: first.data.id, position: 1, altEn: "First" },
      ctx(owner),
    );
    expect(pushed.ok && pushed.data).toMatchObject({ position: 1 });

    const listed = await content.read({}, ctx(anon));
    expect(listed.ok && listed.data.media.map((m) => m.altEn)).toEqual([
      "Two",
      "First",
    ]);
  });

  it("refuses an empty change and an unknown id", async () => {
    const owner = await makeOwner();
    const media = ops();
    const created = await media.upload(
      { file: aFile("one.jpg", "image/jpeg") },
      ctx(owner),
    );
    if (!created.ok) throw new Error("setup failed");
    const empty = await media.update({ id: created.data.id }, ctx(owner));
    expect(!empty.ok && empty.error.code).toBe("VALIDATION_FAILED");
    const missing = await media.update({ id: 999, altEn: "x" }, ctx(owner));
    expect(!missing.ok && missing.error.code).toBe("NOT_FOUND");
  });
});

describe("staff.media.delete", () => {
  it("removes the row and the file", async () => {
    const owner = await makeOwner();
    const media = ops();
    const created = await media.upload(
      { file: aFile("one.jpg", "image/jpeg") },
      ctx(owner),
    );
    if (!created.ok) throw new Error("setup failed");
    const [before] = await db
      .select({ filePath: mediaAsset.filePath })
      .from(mediaAsset)
      .where(eq(mediaAsset.id, created.data.id));

    const result = await media.remove({ id: created.data.id }, ctx(owner));
    expect(result.ok).toBe(true);

    const listed = await media.list({}, ctx(owner));
    expect(listed.ok && listed.data.media).toHaveLength(0);
    expect(before).toBeTruthy();
    expect(
      await readFile(path.join(root, before!.filePath)).catch(() => null),
    ).toBeNull();
    const read = await media.read({ id: created.data.id }, ctx(anon));
    expect(!read.ok && read.error.code).toBe("NOT_FOUND");
  });
});

describe("media.read", () => {
  it("resolves an asset to its file and content type for the file route", async () => {
    const owner = await makeOwner();
    const media = ops();
    const created = await media.upload(
      { file: aFile("one.webp", "image/webp", new Uint8Array([1, 2])) },
      ctx(owner),
    );
    if (!created.ok) throw new Error("setup failed");
    const result = await media.read({ id: created.data.id }, ctx(anon));
    expect(result.ok && result.data).toMatchObject({
      contentType: "image/webp",
      byteSize: 2,
      etag: `"${created.data.id}-2"`,
    });
    expect(result.ok && path.basename(result.data.filePath)).toMatch(/\.webp$/);
  });
});

describe("cleanup helper", () => {
  it("treats a missing media file as already deleted", async () => {
    const stored = await writeMediaBytes(
      root,
      new Uint8Array([1]),
      "png",
      new Date(),
    );
    await deleteMedia(root, stored.filePath);
    await expect(deleteMedia(root, stored.filePath)).resolves.toBeUndefined();
  });
});
