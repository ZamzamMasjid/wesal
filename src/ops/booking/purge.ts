import { and, asc, eq, isNotNull, isNull, lte, ne } from "drizzle-orm";

import type { Database } from "@/db/client";
import { booking, paymentProof } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import type { Logger } from "@/lib/logger";
import { deleteProof } from "@/storage/proofs";

// The screenshot purge (ADR-005, docs/architecture/data-model.md "Retention").
// Files live for one day, but a file is never deleted while its booking is still
// awaiting review: a proof that has waited for days is deleted on the first run
// after staff decide. The row stays and is stamped `purged_at`, so the audit
// trail still shows that a proof existed.

export const PROOF_RETENTION_MS = 24 * 60 * 60 * 1000;
const DAY_MS = PROOF_RETENTION_MS;
const BATCH_SIZE = 200;

export interface PurgeDeps {
  db: Database;
  clock: Clock;
  /** The upload volume root (`UPLOAD_DIR`), or a temporary directory in tests. */
  uploadDir: string;
  logger?: Logger;
}

export interface PurgeSummary {
  /** Files deleted and rows stamped on this run. */
  purged: number;
  /** Files that could not be deleted; their rows stay unstamped and retry tomorrow. */
  failed: number;
}

/** Deletes every proof file older than a day whose booking has left review. */
export async function purgeOldProofs(deps: PurgeDeps): Promise<PurgeSummary> {
  const now = deps.clock.now();
  const cutoff = new Date(now.getTime() - PROOF_RETENTION_MS);

  const candidates = await deps.db
    .select({
      id: paymentProof.id,
      filePath: paymentProof.filePath,
    })
    .from(paymentProof)
    .innerJoin(booking, eq(paymentProof.bookingId, booking.id))
    .where(
      and(
        isNull(paymentProof.purgedAt),
        isNotNull(paymentProof.filePath),
        lte(paymentProof.uploadedAt, cutoff),
        ne(booking.status, "proof_submitted"),
      ),
    )
    .orderBy(asc(paymentProof.uploadedAt), asc(paymentProof.id))
    .limit(BATCH_SIZE);

  const summary: PurgeSummary = { purged: 0, failed: 0 };
  for (const row of candidates) {
    if (!row.filePath) continue;
    try {
      await deleteProof(deps.uploadDir, row.filePath);
      await deps.db
        .update(paymentProof)
        .set({ purgedAt: now })
        .where(and(eq(paymentProof.id, row.id), isNull(paymentProof.purgedAt)));
      summary.purged += 1;
    } catch (error) {
      deps.logger?.error("proof file could not be purged", {
        proofId: row.id,
        err: error,
      });
      summary.failed += 1;
    }
  }
  return summary;
}

/**
 * Runs the purge at most once a day. The job loop wakes every few seconds; this
 * gate keeps file I/O and the query off the other ticks. The first wake-up after
 * a restart always runs it, which is harmless because the purge is idempotent.
 * `run` is called only when the gate opens, so wiring the job does not touch the
 * database until the loop actually ticks.
 */
export function createDailyProofPurge(
  clock: Clock,
  run: () => Promise<PurgeSummary>,
  everyMs = DAY_MS,
): () => Promise<PurgeSummary | null> {
  let lastRun: number | null = null;
  return async () => {
    const now = clock.now().getTime();
    if (lastRun !== null && now - lastRun < everyMs) return null;
    lastRun = now;
    return run();
  };
}
