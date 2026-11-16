import { getDb } from "@/db/client";
import { getSender } from "@/messaging/config";
import { processOutbox } from "@/messaging/outbox";
import { runtime } from "@/lib/runtime";

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
    ],
    // Exit non-zero so Fly's restart policy starts the machine again (ADR-022).
    onStall,
  });
  loop.start();
  logger.info("job loop started");
  return loop;
}
