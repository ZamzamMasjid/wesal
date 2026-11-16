import type { Clock } from "@/lib/clock";
import { lastTickAgeSeconds, recordTick } from "@/lib/job-heartbeat";
import type { Logger } from "@/lib/logger";

// The in-process job loop (ADR-009, ADR-022). One loop wakes on a short
// interval and runs each job in turn. A job run that throws or runs too long is
// logged and skipped, so one bad run never ends the loop. Every wake-up records
// a tick; a watchdog exits the process when the last tick is too old and Fly's
// restart policy starts it again.

export interface Job {
  name: string;
  run: (ctx: { jobId: string; log: Logger }) => Promise<unknown>;
}

export interface JobLoopOptions {
  jobs: Job[];
  clock: Clock;
  logger: Logger;
  /** Time between wake-ups. Default 5 seconds. */
  intervalMs?: number;
  /** A single job run is abandoned (and logged) after this long. Default 30 seconds. */
  runTimeoutMs?: number;
  /** The watchdog fires when the last tick is older than this. Default 120 seconds. */
  staleAfterSeconds?: number;
  /** Called by the watchdog. Production exits the process. */
  onStall?: (ageSeconds: number) => void;
}

export interface JobLoop {
  /** Runs every job once, now. Resolves when all runs finished or timed out. */
  tick(): Promise<void>;
  /** Checks the last tick's age; calls `onStall` and returns true when it is too old. */
  checkWatchdog(): boolean;
  start(): void;
  stop(): void;
}

const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_RUN_TIMEOUT_MS = 30_000;
const DEFAULT_STALE_SECONDS = 120;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`job run timed out after ${ms} ms`)),
      ms,
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function createJobLoop(options: JobLoopOptions): JobLoop {
  const {
    jobs,
    clock,
    logger,
    intervalMs = DEFAULT_INTERVAL_MS,
    runTimeoutMs = DEFAULT_RUN_TIMEOUT_MS,
    staleAfterSeconds = DEFAULT_STALE_SECONDS,
    onStall = () => undefined,
  } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let running = false;

  async function runJob(job: Job): Promise<void> {
    const jobId = crypto.randomUUID();
    const log = logger.child({ job: job.name, jobId });
    try {
      // `Promise.resolve().then` so a job that throws synchronously is caught too.
      const result = await withTimeout(
        Promise.resolve().then(() => job.run({ jobId, log })),
        runTimeoutMs,
      );
      log.debug("job run finished", { result });
    } catch (err) {
      log.error("job run failed", { err });
    }
  }

  async function tick(): Promise<void> {
    recordTick(clock);
    for (const job of jobs) {
      await runJob(job);
      // A tick with several jobs can outlast the watchdog window even though each
      // run is time-limited; beating after every run keeps the age bounded by one run.
      recordTick(clock);
    }
  }

  function schedule(): void {
    if (!running) return;
    timer = setTimeout(() => {
      void tick().finally(schedule);
    }, intervalMs);
  }

  function checkWatchdog(): boolean {
    const age = lastTickAgeSeconds(clock);
    if (age === null || age <= staleAfterSeconds) return false;
    logger.error("job loop stalled; the process will restart", {
      lastTickAgeSeconds: age,
      staleAfterSeconds,
    });
    onStall(age);
    return true;
  }

  return {
    tick,
    checkWatchdog,
    start() {
      if (running) return;
      running = true;
      recordTick(clock);
      watchdog = setInterval(
        checkWatchdog,
        Math.max(1_000, Math.floor((staleAfterSeconds * 1000) / 4)),
      );
      watchdog.unref?.();
      void tick().finally(schedule);
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      if (watchdog) clearInterval(watchdog);
    },
  };
}
