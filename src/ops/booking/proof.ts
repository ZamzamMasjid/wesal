import { eq } from "drizzle-orm";
import { z } from "zod";

import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { booking, occasion, paymentProof } from "@/db/schema";
import {
  MAX_PROOF_BYTES,
  PROOF_MIME_TYPES,
  type ProofMime,
} from "@/lib/proof-api";
import { publicBaseUrl } from "@/messaging/config";
import { queueStaffAlert } from "@/messaging/staff-alerts";
import {
  deleteProof,
  readProof,
  uploadRoot,
  writeProof,
} from "@/storage/proofs";

import { effectiveStatus } from "./read";

// Uploading the transfer screenshot (docs/features/payment-proof). The holder's
// link token is the key; nothing about the phone number or the file name is
// logged. The file is written first and the row commits with the status change,
// so a failed transaction never leaves a proof without its file, and a failed
// write leaves the booking held. Once uploaded the clock stops: from
// `proof_submitted` on, only a staff decision moves the booking.

/** The extension and content type a sniffer result is stored and served as. */
const IMAGE_FORMATS: Record<
  ProofMime,
  { extension: string; contentType: string }
> = {
  "image/jpeg": { extension: "jpg", contentType: "image/jpeg" },
  "image/png": { extension: "png", contentType: "image/png" },
  "image/webp": { extension: "webp", contentType: "image/webp" },
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * The image type, read from the file's first bytes rather than its name or the
 * browser's claim. Returns null for anything that is not a supported image.
 */
export function sniffProofImage(bytes: Uint8Array): ProofMime | null {
  const head = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    head.length >= 3 &&
    head[0] === 0xff &&
    head[1] === 0xd8 &&
    head[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    head.length >= PNG_MAGIC.length &&
    head.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)
  ) {
    return "image/png";
  }
  if (
    head.length >= 12 &&
    head.toString("ascii", 0, 4) === "RIFF" &&
    head.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** A multipart part, without trusting the DOM `File` type across runtimes. */
interface FileLike {
  size: number;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

function isFileLike(value: unknown): value is FileLike {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
}

const uploadInput = z.object({
  token: z.string().trim().min(1).max(200),
  /** The multipart part; validated in the handler so a bad file is INVALID_FILE. */
  file: z.unknown(),
});

const staffFileInput = z.object({
  id: z.coerce.number().int().positive(),
});

export interface ProofUploaded {
  status: "proof_submitted";
  proofId: number;
  uploadedAt: string;
}

export interface ProofFile {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
}

export interface ProofDeps {
  db: Database;
  /** The upload volume root (`UPLOAD_DIR`), or a temporary directory in tests. */
  uploadDir: string;
  /** Public origin, for the review link in the staff alert. */
  baseUrl: string;
}

function extensionOf(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  return dot === -1 ? "" : filePath.slice(dot + 1).toLowerCase();
}

function contentTypeOf(filePath: string): string {
  const extension = extensionOf(filePath);
  const found = PROOF_MIME_TYPES.find(
    (mime) => IMAGE_FORMATS[mime].extension === extension,
  );
  return found ? IMAGE_FORMATS[found].contentType : "application/octet-stream";
}

const expired = (status: string) =>
  new ApiError("HOLD_EXPIRED", "This booking can no longer receive a proof.", {
    status,
  });

function missingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

export function createProofOperations(resolve: () => ProofDeps) {
  const upload = defineOperation({
    name: "bookings.proof",
    access: "holder",
    input: uploadInput,
    handler: async (input, ctx): Promise<ProofUploaded> => {
      const deps = resolve();
      const now = ctx.clock.now();

      const file = input.file;
      if (!isFileLike(file)) {
        throw new ApiError("INVALID_FILE", "Choose an image to upload.");
      }
      if (file.size > MAX_PROOF_BYTES) {
        throw new ApiError(
          "FILE_TOO_LARGE",
          `The screenshot must be at most ${MAX_PROOF_BYTES} bytes.`,
        );
      }
      if (file.size === 0) {
        throw new ApiError("INVALID_FILE", "The file is empty.");
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > MAX_PROOF_BYTES) {
        throw new ApiError("FILE_TOO_LARGE", "The screenshot is too large.");
      }
      const mime = sniffProofImage(bytes);
      if (!mime) {
        throw new ApiError(
          "INVALID_FILE",
          "Only JPEG, PNG and WebP images are accepted.",
        );
      }

      // Fast refusal before a byte reaches the volume. The transaction below
      // checks again under a row lock, because a hold can expire in between.
      const [found] = await deps.db
        .select({
          id: booking.id,
          status: booking.status,
          holdExpiresAt: booking.holdExpiresAt,
        })
        .from(booking)
        .where(eq(booking.accessToken, input.token))
        .limit(1);
      if (!found) {
        throw new ApiError("NOT_FOUND", "No booking with that link.");
      }
      const initial = effectiveStatus(found.status, found.holdExpiresAt, now);
      if (initial !== "held" && initial !== "proof_submitted") {
        // ADR-010: an overdue hold is expired even if the sweep has not run, so
        // stamp the row before refusing. The transaction below repeats this
        // check for the rare case where the deadline passes mid-upload.
        if (initial === "expired" && found.status === "held") {
          await deps.db
            .update(booking)
            .set({ status: "expired", updatedAt: now })
            .where(eq(booking.id, found.id));
        }
        throw expired(initial);
      }

      let stored: { filePath: string };
      try {
        stored = await writeProof(
          deps.uploadDir,
          bytes,
          IMAGE_FORMATS[mime].extension,
          now,
        );
      } catch (error) {
        ctx.log.error("proof file write failed", {
          bookingId: found.id,
          err: error,
        });
        throw new ApiError(
          "SERVICE_UNAVAILABLE",
          "The screenshot could not be saved. Try again or send it on WhatsApp.",
          { reason: "storage" },
        );
      }

      try {
        return await deps.db.transaction(async (tx) => {
          const [current] = await tx
            .select({
              id: booking.id,
              publicId: booking.publicId,
              status: booking.status,
              holdExpiresAt: booking.holdExpiresAt,
              customerName: booking.customerName,
              startsAt: booking.startsAt,
              depositEgp: booking.depositEgp,
              occasionNameAr: occasion.nameAr,
              occasionNameEn: occasion.nameEn,
            })
            .from(booking)
            .innerJoin(occasion, eq(booking.occasionId, occasion.id))
            .where(eq(booking.id, found.id))
            .for("update");
          if (!current) {
            throw new ApiError("NOT_FOUND", "No booking with that link.");
          }

          const status = effectiveStatus(
            current.status,
            current.holdExpiresAt,
            now,
          );
          if (status !== "held" && status !== "proof_submitted") {
            // ADR-010: an overdue hold is expired now, so the stored status
            // matches the answer even if the sweep has not run.
            if (status === "expired" && current.status === "held") {
              await tx
                .update(booking)
                .set({ status: "expired", updatedAt: now })
                .where(eq(booking.id, current.id));
            }
            throw expired(status);
          }

          const [row] = await tx
            .insert(paymentProof)
            .values({
              bookingId: current.id,
              filePath: stored.filePath,
              receivedVia: "upload",
              uploadedAt: now,
            })
            .returning({
              id: paymentProof.id,
              uploadedAt: paymentProof.uploadedAt,
            });
          if (!row) throw new ApiError("INTERNAL", "Proof not written.");

          // Uploading stops the clock: the countdown is gone from the page and
          // only a staff decision moves the booking from here.
          if (status === "held") {
            await tx
              .update(booking)
              .set({
                status: "proof_submitted",
                holdExpiresAt: null,
                updatedAt: now,
              })
              .where(eq(booking.id, current.id));
          }

          // The alert belongs to the proof, not to the first status change: a
          // second screenshot while awaiting review is worth telling staff about.
          await queueStaffAlert(tx, ctx.clock, {
            kind: "proof",
            booking: {
              id: current.id,
              publicId: current.publicId,
              customerName: current.customerName,
              occasionNameAr: current.occasionNameAr,
              occasionNameEn: current.occasionNameEn,
              startsAt: current.startsAt,
              depositEgp: current.depositEgp,
            },
            baseUrl: deps.baseUrl,
            logger: ctx.log,
          });

          return {
            status: "proof_submitted",
            proofId: row.id,
            uploadedAt: row.uploadedAt.toISOString(),
          };
        });
      } catch (error) {
        // The row did not commit, so the file has no owner: remove it.
        try {
          await deleteProof(deps.uploadDir, stored.filePath);
        } catch (cleanupError) {
          ctx.log.error("orphan proof file could not be removed", {
            filePath: stored.filePath,
            err: cleanupError,
          });
        }
        throw error;
      }
    },
  });

  const staffFile = defineOperation({
    name: "staff.proofs.file",
    access: "staff",
    input: staffFileInput,
    handler: async ({ id }): Promise<ProofFile> => {
      const deps = resolve();
      const [row] = await deps.db
        .select({
          filePath: paymentProof.filePath,
          purgedAt: paymentProof.purgedAt,
        })
        .from(paymentProof)
        .where(eq(paymentProof.id, id))
        .limit(1);

      if (!row || !row.filePath || row.purgedAt) {
        throw new ApiError(
          "NOT_FOUND",
          "The screenshot is no longer available.",
        );
      }

      let bytes: Buffer;
      try {
        bytes = await readProof(deps.uploadDir, row.filePath);
      } catch (error) {
        if (missingFile(error)) {
          throw new ApiError(
            "NOT_FOUND",
            "The screenshot is no longer available.",
          );
        }
        throw error;
      }

      return {
        bytes,
        contentType: contentTypeOf(row.filePath),
        fileName: `proof-${id}.${extensionOf(row.filePath)}`,
      };
    },
  });

  return { upload, staffFile };
}

export const proofOperations = createProofOperations(() => ({
  db: getDb(),
  uploadDir: uploadRoot(),
  baseUrl: publicBaseUrl(),
}));
