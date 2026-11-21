// SPEC: docs/features/content-management — uploads are checked for type before being written; files live on the volume under a name that reveals nothing; deleting removes the file
// ROADMAP: phase-5-public-site / content-management / Implement media upload and ordering for photos and videos on the volume
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  classifyMedia,
  deleteMedia,
  diskSpace,
  resolveMediaPath,
  writeMedia,
  writeMediaBytes,
} from "./media";

let root = "";
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "wesal-storage-"));
});
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe("classifyMedia", () => {
  it("reads common photo and video types", () => {
    expect(classifyMedia("image/jpeg")).toMatchObject({
      kind: "photo",
      extension: "jpg",
      mimeType: "image/jpeg",
    });
    expect(classifyMedia("video/mp4")).toMatchObject({
      kind: "video",
      extension: "mp4",
    });
    expect(classifyMedia("video/quicktime")).toMatchObject({
      kind: "video",
      extension: "mov",
    });
  });

  it("falls back to the extension when the MIME type is empty", () => {
    expect(classifyMedia("", "tour.MOV")).toMatchObject({
      kind: "video",
      extension: "mov",
      mimeType: "video/quicktime",
    });
    expect(classifyMedia("", "photo.PNG")).toMatchObject({
      kind: "photo",
      extension: "png",
    });
  });

  it("refuses an unknown type and a type that contradicts the extension", () => {
    expect(classifyMedia("text/plain", "notes.txt")).toBeNull();
    expect(classifyMedia("application/pdf")).toBeNull();
    expect(classifyMedia("image/png", "tour.mp4")).toBeNull();
  });
});

describe("resolveMediaPath", () => {
  it("accepts only paths this module writes", () => {
    expect(resolveMediaPath(root, "media/abc-123.png")).toBe(
      path.join(root, "media/abc-123.png"),
    );
    for (const bad of [
      "proofs/abc.png",
      "media/../secret.png",
      "media/abc.png/../x",
      "/etc/passwd",
    ]) {
      expect(() => resolveMediaPath(root, bad)).toThrow();
    }
  });
});

describe("writeMedia", () => {
  it("streams bytes to a fresh name and reports the written size", async () => {
    const source = Readable.toWeb(
      Readable.from([Buffer.from([1, 2, 3]), Buffer.from([4])]),
    ) as ReadableStream<Uint8Array>;
    let last = 0;
    const stored = await writeMedia(root, source, "png", new Date(), (n) => {
      last = n;
    });
    expect(stored.byteSize).toBe(4);
    expect(last).toBe(4);
    expect(stored.filePath).toMatch(/^media\/[a-z0-9]+-[a-f0-9]+\.png$/);
    expect(
      new Uint8Array(await readFile(resolveMediaPath(root, stored.filePath))),
    ).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("deletes a file and treats a repeated delete as harmless", async () => {
    const stored = await writeMediaBytes(
      root,
      new Uint8Array([7]),
      "jpg",
      new Date(),
    );
    await deleteMedia(root, stored.filePath);
    await expect(deleteMedia(root, stored.filePath)).resolves.toBeUndefined();
  });

  it("reports the volume's free space", async () => {
    const space = await diskSpace(root);
    expect(space.totalBytes).toBeGreaterThan(0);
    expect(space.freeBytes).toBeGreaterThan(0);
    expect(space.usedBytes).toBeLessThanOrEqual(space.totalBytes);
  });
});
