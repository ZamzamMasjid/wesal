// SPEC: message-delivery/spec.md — the job loop runs inside the app machine and sends outbox messages; ADR-022: a stalled loop restarts the process
// ROADMAP: phase-2-foundations / message-delivery / Implement outbox table and in-process job loop with retry and backoff
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const created: Array<{
  jobs: { name: string }[];
  onStall: (n: number) => void;
}> = [];
const start = vi.fn();

vi.mock("./loop", () => ({
  createJobLoop: (options: (typeof created)[number]) => {
    created.push(options);
    return { start, stop: vi.fn(), tick: vi.fn(), checkWatchdog: vi.fn() };
  },
}));

beforeEach(() => {
  vi.resetModules();
  created.length = 0;
  start.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("startJobs", () => {
  it("starts one loop with the outbox, hold-sweep and proof-purge jobs and starts it only once", async () => {
    const { startJobs } = await import("./start");
    const first = startJobs(() => undefined);
    expect(startJobs()).toBe(first);
    expect(created).toHaveLength(1);
    expect(created[0]!.jobs.map((j) => j.name)).toEqual([
      "outbox",
      "holds",
      "proof-purge",
    ]);
    expect(start).toHaveBeenCalledOnce();
  });

  it("hands a stall to the given exit handler", async () => {
    const { startJobs } = await import("./start");
    const exit = vi.fn();
    startJobs(exit);
    created[0]!.onStall(130);
    expect(exit).toHaveBeenCalledWith(130);
  });

  it("exits the process non-zero by default when the loop stalls", async () => {
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    try {
      const { startJobs } = await import("./start");
      startJobs();
      created[0]!.onStall(130);
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      exit.mockRestore();
    }
  });
});

describe("instrumentation register", () => {
  it("starts the loop in the Node.js runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("JOBS", "");
    const { register } = await import("../instrumentation");
    await register();
    expect(start).toHaveBeenCalledOnce();
  });

  it("does nothing on the edge runtime or when JOBS=off", async () => {
    const { register } = await import("../instrumentation");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("JOBS", "off");
    await register();
    expect(start).not.toHaveBeenCalled();
  });
});
