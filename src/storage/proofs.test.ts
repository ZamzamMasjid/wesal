// SPEC: docs/architecture/overview.md — files live on the upload volume; docs/features/payment-proof — screenshots are stored there and served to staff only
// ROADMAP: phase-3-booking / payment-proof / Implement proof upload endpoint: type and size checks, store on volume, stop countdown
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  deleteProof,
  readProof,
  resolveProofPath,
  uploadRoot,
  writeProof,
} from "./proofs";

const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

let root = "";

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "wesal-proofs-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("proof storage", () => {
  it("writes a randomly named file under proofs/ and reads it back", async () => {
    const stored = await writeProof(root, jpeg(), "jpg", new Date(0));

    expect(stored.filePath).toMatch(/^proofs\/[a-z0-9]+-[a-f0-9]{16}\.jpg$/);
    const bytes = await readProof(root, stored.filePath);
    expect(bytes.equals(jpeg())).toBe(true);
  });

  it("gives two uploads different names", async () => {
    const first = await writeProof(root, jpeg(), "jpg", new Date(0));
    const second = await writeProof(root, jpeg(), "jpg", new Date(0));
    expect(first.filePath).not.toBe(second.filePath);
  });

  it("deletes a file, and deleting a missing file is harmless", async () => {
    const stored = await writeProof(root, jpeg(), "jpg", new Date(0));
    await deleteProof(root, stored.filePath);
    await expect(
      readFile(resolveProofPath(root, stored.filePath)),
    ).rejects.toThrow();
    await expect(deleteProof(root, stored.filePath)).resolves.toBeUndefined();
  });

  it("refuses a path that could escape the proofs directory", () => {
    for (const bad of [
      "proofs/../secret.png",
      "../proofs/a.png",
      "/etc/passwd",
      "proofs/a/b.png",
      "media/a.jpg",
    ]) {
      expect(() => resolveProofPath(root, bad)).toThrow();
    }
  });

  it("defaults to db/uploads and honors UPLOAD_DIR when set", () => {
    expect(uploadRoot({})).toBe(path.join(process.cwd(), "db", "uploads"));
    expect(uploadRoot({ UPLOAD_DIR: "  " })).toBe(
      path.join(process.cwd(), "db", "uploads"),
    );
    expect(uploadRoot({ UPLOAD_DIR: "/data" })).toBe("/data");
  });
});
