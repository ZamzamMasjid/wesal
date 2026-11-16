// SPEC: docs/architecture/testing.md — unit tests for pure rules (ADR-027 logger)
// ROADMAP: phase-1-infrastructure / testing / Install Vitest + v8 coverage; add `test` and `coverage` scripts
import { describe, expect, it } from "vitest";

import { createFakeClock } from "@/test/fake-clock";

import { createLogger, formatLine, parseLogLevel, REDACTED } from "./logger";

function collect(level?: "debug" | "info" | "warn" | "error") {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    clock: createFakeClock(),
    level,
    write: (l) => lines.push(JSON.parse(l)),
  });
  return { lines, logger };
}

describe("logger", () => {
  it("writes level, ISO time from the injected clock, and msg", () => {
    const { lines, logger } = collect();
    logger.info("hello", { a: 1 });
    expect(lines).toEqual([
      { level: "info", time: "2026-01-01T10:00:00.000Z", msg: "hello", a: 1 },
    ]);
  });

  it("drops lines below the minimum level", () => {
    const { lines, logger } = collect("warn");
    logger.debug("x");
    logger.info("x");
    logger.warn("w");
    logger.error("e");
    expect(lines.map((l) => l.msg)).toEqual(["w", "e"]);
  });

  it("child loggers add bindings", () => {
    const { lines, logger } = collect();
    logger.child({ requestId: "r1" }).child({ jobId: "j" }).info("m");
    expect(lines[0]).toMatchObject({ requestId: "r1", jobId: "j" });
  });

  it("redacts sensitive keys at any depth", () => {
    const { lines, logger } = collect();
    logger.info("m", { phone: "0100", nested: { Token: "t", ok: 1 } });
    expect(lines[0]).toMatchObject({
      phone: REDACTED,
      nested: { Token: REDACTED, ok: 1 },
    });
  });

  it("keeps reserved keys under an underscore name", () => {
    const { lines, logger } = collect();
    logger.info("m", { msg: "evil", level: "x" });
    expect(lines[0]).toMatchObject({ msg: "m", _msg: "evil", _level: "x" });
  });

  it("serializes errors, bigint and circular values without throwing", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const err = Object.assign(new Error("boom"), { cause: "c" });
    const line = JSON.parse(
      formatLine("error", new Date(0), "m", {}, { err, n: 5n, circular }),
    );
    expect(line.err).toMatchObject({
      name: "Error",
      message: "boom",
      cause: "c",
    });
    expect(line.n).toBe("5");
    expect(line.circular.self).toBe("[Circular]");
  });

  it("falls back when fields cannot be serialized", () => {
    const bad = {
      toJSON: () => {
        throw new Error("no");
      },
    };
    const line = JSON.parse(formatLine("info", new Date(0), "m", {}, { bad }));
    expect(line.logError).toBeDefined();
  });

  it("parses log levels with a fallback", () => {
    expect(parseLogLevel("debug")).toBe("debug");
    expect(parseLogLevel("nope")).toBe("info");
    expect(parseLogLevel(undefined, "warn")).toBe("warn");
  });
});
