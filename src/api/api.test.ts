// SPEC: docs/architecture/overview.md — operations: access check, validation, fixed envelope, one error-code registry (ADR-026)
// ROADMAP: phase-1-infrastructure / testing / Configure Vitest projects: unit, and integration against real Postgres with per-test isolation
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createLogger } from "@/lib/logger";
import type { Runtime } from "@/lib/runtime";
import { createFakeClock } from "@/test/fake-clock";

import { authorize, resolveCaller, type Caller } from "./caller";
import { createCallContext } from "./context";
import { ApiError, ERROR_STATUS, statusForCode } from "./errors";
import { apiNotFound, respond, route } from "./http";
import { defineOperation } from "./operation";

const clock = createFakeClock();
const logs: string[] = [];
const deps: Runtime = {
  clock,
  logger: createLogger({ clock, write: (l) => logs.push(l) }),
};
const owner: Caller = { kind: "staff", userId: "1", role: "owner" };
const staff: Caller = { kind: "staff", userId: "2", role: "staff" };
const anon: Caller = { kind: "anonymous" };
const ctx = (caller: Caller) =>
  createCallContext(caller, { requestId: "req", deps });

describe("authorize", () => {
  it("allows anonymous and holder access for anyone", () => {
    expect(authorize("anonymous", anon)).toBe("allowed");
    expect(authorize("holder", anon)).toBe("allowed");
  });
  it("requires a staff session for staff access", () => {
    expect(authorize("staff", anon)).toBe("unauthenticated");
    expect(authorize("staff", staff)).toBe("allowed");
  });
  it("forbids staff on owner-only access", () => {
    expect(authorize("owner", anon)).toBe("unauthenticated");
    expect(authorize("owner", staff)).toBe("forbidden");
    expect(authorize("owner", owner)).toBe("allowed");
  });
  it("fails closed on an unknown access level", () => {
    expect(authorize("weird" as never, owner)).toBe("forbidden");
  });
  it("resolves to anonymous when there is no session", async () => {
    const auth = { api: { getSession: async () => null } } as never;
    expect(await resolveCaller(new Request("http://x/"), auth)).toEqual(anon);
  });
});

describe("error registry", () => {
  it("maps codes to fixed statuses", () => {
    expect(statusForCode("SLOT_TAKEN")).toBe(409);
    expect(ERROR_STATUS.INTERNAL).toBe(500);
  });
});

const echo = defineOperation({
  name: "test.echo",
  access: "staff",
  input: z.object({ n: z.number() }),
  handler: async ({ n }) => ({ n }),
});
const failing = defineOperation({
  name: "test.fail",
  access: "anonymous",
  input: z.object({}),
  handler: async () => {
    throw new ApiError("SLOT_TAKEN", "taken", { slotId: 1 });
  },
});
const crashing = defineOperation({
  name: "test.crash",
  access: "anonymous",
  input: z.object({}),
  handler: async () => {
    throw new Error("secret internals");
  },
});

describe("defineOperation", () => {
  it("returns data for an authorized, valid call", async () => {
    expect(await echo({ n: 1 }, ctx(staff))).toEqual({
      ok: true,
      data: { n: 1 },
    });
  });
  it("denies before validating", async () => {
    const r = await echo({ n: "bad" }, ctx(anon));
    expect(r).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED", requestId: "req" },
    });
  });
  it("reports forbidden", async () => {
    const op = defineOperation({
      name: "o",
      access: "owner",
      input: z.object({}),
      handler: async () => 1,
    });
    expect(await op({}, ctx(staff))).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });
  it("reports validation issues", async () => {
    const r = await echo({ n: "x" }, ctx(staff));
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
    expect(JSON.stringify(r)).toContain("issues");
  });
  it("maps ApiError to its code and details", async () => {
    expect(await failing({}, ctx(anon))).toMatchObject({
      ok: false,
      error: { code: "SLOT_TAKEN", details: { slotId: 1 } },
    });
  });
  it("hides unexpected errors and logs them", async () => {
    const r = await crashing({}, ctx(anon));
    expect(r).toMatchObject({
      ok: false,
      error: { code: "INTERNAL", message: "Something went wrong." },
    });
    expect(JSON.stringify(r)).not.toContain("secret");
    expect(logs.some((l) => l.includes("unhandled operation error"))).toBe(
      true,
    );
  });
  it("exposes name and access", () => {
    expect(echo.operationName).toBe("test.echo");
    expect(echo.access).toBe("staff");
  });
});

describe("http route", () => {
  const post = (body: string) =>
    new Request("http://x/api/v1/t", { method: "POST", body });
  const open = defineOperation({
    name: "test.open",
    access: "anonymous",
    input: z.object({ n: z.number(), id: z.string().optional() }),
    handler: async (i) => i,
  });

  it("reads a JSON body and merges path params over it", async () => {
    const res = await route(open, { successStatus: 201 })(
      post('{"n":1,"id":"body"}'),
      { params: Promise.resolve({ id: "path" }) },
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, data: { n: 1, id: "path" } });
  });
  it("reads the query string on GET, including repeated keys", async () => {
    const seen = defineOperation({
      name: "q",
      access: "anonymous",
      input: z.object({ a: z.array(z.string()), b: z.string() }),
      handler: async (i) => i,
    });
    const res = await route(seen)(new Request("http://x/api/v1/t?a=1&a=2&b=3"));
    expect(await res.json()).toEqual({
      ok: true,
      data: { a: ["1", "2"], b: "3" },
    });
  });
  it("accepts an empty body", async () => {
    const none = defineOperation({
      name: "e",
      access: "anonymous",
      input: z.object({}),
      handler: async () => "ok",
    });
    const res = await route(none)(post("  "));
    expect(res.status).toBe(200);
  });
  it("rejects invalid JSON and non-object bodies with 422", async () => {
    for (const body of ["{nope", "[1]"]) {
      const res = await route(open)(post(body));
      expect(res.status).toBe(422);
      expect((await res.json()).error.code).toBe("VALIDATION_FAILED");
    }
  });
  it("maps operation failures to their status", async () => {
    const res = await route(failing)(post("{}"));
    expect(res.status).toBe(409);
  });
  it("returns INTERNAL when input building throws unexpectedly", async () => {
    const res = await route(open, {
      input: () => {
        throw new Error("x");
      },
    })(post("{}"));
    expect(res.status).toBe(500);
  });
  it("passes through an ApiError thrown while building input", async () => {
    const res = await route(open, {
      input: () => {
        throw new ApiError("INVALID_FILE");
      },
    })(post("{}"));
    expect(res.status).toBe(422);
  });
  it("answers unknown endpoints with the envelope", async () => {
    const res = apiNotFound();
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
    expect(respond({ ok: true, data: 1 }, "r").status).toBe(200);
  });
});

describe("createCallContext", () => {
  it("generates a request id by default", () => {
    expect(createCallContext(anon).requestId).toMatch(/[0-9a-f-]{36}/);
  });
});
