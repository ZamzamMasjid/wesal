import { getDb } from "@/db/client";
import { runtime } from "@/lib/runtime";
import { getSender, publicBaseUrl } from "@/messaging/config";
import { processOutbox } from "@/messaging/outbox";
import { createDailyProofPurge, purgeOldProofs } from "@/ops/booking/purge";
import { expireOverdueHolds } from "@/ops/booking/sweep";
import { uploadRoot } from "@/storage/proofs";

import { createJobLoop, type JobLoop } from "./loop";

// Starts the production job loop inside the web process. Called once from
// src/instrumentation.ts. Later sections add their jobs here (hold sweep,
// screenshot purge).

let loop: JobLoop | undefined;

export function startJobs(
  onStall: (ageSeconds: number) => void = () => process.exit(1),
): JobLoop {
  if (loop) return loop;
  const { clock, logger } = runtime;
  // One gate per process: the loop ticks every few seconds, the purge runs daily.
  // The database and the volume are wired lazily, when the gate first opens.
  const runProofPurge = createDailyProofPurge(clock, () =>
    purgeOldProofs({
      db: getDb(),
      clock,
      uploadDir: uploadRoot(),
      logger,
    }),
  );
  loop = createJobLoop({
    clock,
    logger,
    jobs: [
      {
        name: "outbox",
        run: ({ log }) =>
          processOutbox({
            db: getDb(),
            sender: getSender(),
            clock,
            logger: log,
          }),
      },
      {
        name: "holds",
        run: async ({ log }) => {
          const summary = await expireOverdueHolds({
            db: getDb(),
            clock,
            baseUrl: publicBaseUrl(),
          });
          if (summary.expired > 0) {
            log.info("overdue holds expired", { expired: summary.expired });
          }
          return summary;
        },
      },
      {
        name: "proof-purge",
        run: async ({ log }) => {
          const summary = await runProofPurge();
          if (summary && (summary.purged > 0 || summary.failed > 0)) {
            log.info("old proof files purged", {
              purged: summary.purged,
              failed: summary.failed,
            });
          }
          return summary;
        },
      },
    ],
    // Exit non-zero so Fly's restart policy starts the machine again (ADR-022).
    onStall,
  });
  loop.start();
  logger.info("job loop started");
  return loop;
}
