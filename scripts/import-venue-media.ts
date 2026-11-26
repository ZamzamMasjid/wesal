// One-off import of the venue photographs in `assets/venue` into the normal
// media store (docs/features/content-management). The files are copied to the
// upload volume and recorded in `media_asset`, so the landing page reads them
// through the same public endpoint the owner's editor uses.
//
// Order is the gallery order: the first entry becomes the hero (docs/features/
// landing-page). Run with `npm run media:import`; pass `--replace` to clear an
// existing library first. Originals live outside `public/`, so they are never
// served directly and the app keeps one source for media.
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createDb, requireDatabaseUrl, type Database } from "../src/db/client";
import { mediaAsset } from "../src/db/schema";
import { deleteMedia, writeMediaBytes } from "../src/storage/media";
import { uploadRoot } from "../src/storage/proofs";

interface Entry {
  file: string;
  altAr: string;
  altEn: string;
}

async function importMedia(db: Database, replace: boolean): Promise<void> {
  const root = uploadRoot();
  const existing = await db
    .select({ id: mediaAsset.id, filePath: mediaAsset.filePath })
    .from(mediaAsset);

  if (existing.length > 0 && !replace) {
    throw new Error(
      "The media library is not empty. Re-run with --replace to remove it and import these photos.",
    );
  }

  if (replace) {
    for (const row of existing) await deleteMedia(root, row.filePath);
    await db.delete(mediaAsset);
  }

  const raw = await readFile(
    path.join(process.cwd(), "scripts", "venue-media.json"),
    "utf8",
  );
  const manifest = JSON.parse(raw) as Entry[];
  if (manifest.length === 0) throw new Error("The media manifest is empty.");

  const folder = path.join(process.cwd(), "assets", "venue");
  const written: string[] = [];
  const rows = [];

  for (const [position, entry] of manifest.entries()) {
    const data = await readFile(path.join(folder, entry.file));
    const stored = await writeMediaBytes(root, data, "jpg", new Date());
    written.push(stored.filePath);
    rows.push({
      kind: "photo" as const,
      filePath: stored.filePath,
      mimeType: "image/jpeg",
      byteSize: stored.byteSize,
      altAr: entry.altAr,
      altEn: entry.altEn,
      position,
    });
  }

  try {
    await db.insert(mediaAsset).values(rows);
  } catch (error) {
    // Do not leave orphaned files on the volume if the insert fails.
    for (const filePath of written) await deleteMedia(root, filePath);
    throw error;
  }

  process.stdout.write(
    `Imported ${rows.length} photos; the first is the page hero.\n`,
  );
}

async function main(): Promise<void> {
  const { db, pool } = createDb(requireDatabaseUrl());
  try {
    await importMedia(db, process.argv.includes("--replace"));
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  /import-venue-media\.[cm]?[tj]s$/.test(process.argv[1])
) {
  main().catch((error: unknown) => {
    process.stderr.write(`Media import failed: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
