import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Files on the upload volume (docs/architecture/overview.md, ADR-005). Only the
// service layer under `ops/` reads or writes here. Screenshots live in the
// `proofs/` directory of `UPLOAD_DIR`; the database stores a path relative to
// that root, never an absolute one, so the volume can move.

/** The directory under `UPLOAD_DIR` that holds payment screenshots. */
export const PROOFS_FOLDER = "proofs";

/**
 * Where the upload volume is mounted. Production sets `UPLOAD_DIR=/data`
 * (fly.toml); development without it writes under the ignored `db/uploads`.
 */
export function uploadRoot(
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.UPLOAD_DIR?.trim();
  return configured ? configured : path.join(process.cwd(), "db", "uploads");
}

/** A relative proof path is only ever one we wrote: `proofs/<name>.<ext>`. */
const RELATIVE_PROOF_PATH = /^proofs\/[A-Za-z0-9_-]+\.[a-z0-9]+$/;

/** Resolves a stored proof path against the volume root, refusing anything else. */
export function resolveProofPath(root: string, relative: string): string {
  if (!RELATIVE_PROOF_PATH.test(relative)) {
    throw new Error(`Refusing to use an unexpected proof path: ${relative}`);
  }
  return path.join(root, relative);
}

export interface StoredProof {
  /** Relative to `UPLOAD_DIR`, e.g. "proofs/0abc-1def.png". */
  filePath: string;
}

/**
 * Writes one screenshot and returns its relative path. The name is random:
 * nothing about the customer or the booking appears in a file name.
 */
export async function writeProof(
  root: string,
  data: Uint8Array,
  extension: string,
  now: Date,
): Promise<StoredProof> {
  const name = `${now.getTime().toString(36)}-${randomBytes(8).toString("hex")}.${extension}`;
  const filePath = `${PROOFS_FOLDER}/${name}`;
  const absolute = resolveProofPath(root, filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, data);
  return { filePath };
}

export async function readProof(
  root: string,
  relative: string,
): Promise<Buffer> {
  return readFile(resolveProofPath(root, relative));
}

function missingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * Deletes a proof file. A file that is already gone is treated as deleted, so a
 * repeated purge is harmless.
 */
export async function deleteProof(
  root: string,
  relative: string,
): Promise<void> {
  try {
    await unlink(resolveProofPath(root, relative));
  } catch (error) {
    if (!missingFile(error)) throw error;
  }
}
