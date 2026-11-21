// SPEC: docs/features/landing-page — media streams with range requests and immutable cache headers
// ROADMAP: phase-5-public-site / landing-page / Serve media with range requests and caching headers
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { mediaRoute, type MediaSource } from "./http";

const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
let root = "";
let file = "";

const source: MediaSource = {
  filePath: "",
  contentType: "video/mp4",
  byteSize: bytes.byteLength,
  etag: '"1-10"',
};

const operation = Object.assign(
  async () => ({ ok: true as const, data: source }),
  { operationName: "media.read", access: "anonymous" as const },
);

const handler = mediaRoute(operation);

function request(range?: string, etag?: string): Request {
  return new Request("http://localhost/api/v1/media/1", {
    headers: {
      ...(range ? { range } : {}),
      ...(etag ? { "if-none-match": etag } : {}),
    },
  });
}

function call(init: Request) {
  return handler(init, { params: Promise.resolve({ id: "1" }) });
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "wesal-media-route-"));
  file = path.join(root, "clip.mp4");
  await writeFile(file, bytes);
  source.filePath = file;
});

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe("mediaRoute", () => {
  it("serves the whole file with an immutable public cache", async () => {
    const response = await call(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("etag")).toBe('"1-10"');
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it("answers a byte range with 206 and the slice", async () => {
    const response = await call(request("bytes=2-4"));
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(response.headers.get("content-length")).toBe("3");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([2, 3, 4]),
    );
  });

  it("answers an open-ended range", async () => {
    const response = await call(request("bytes=7-"));
    expect(response.status).toBe(206);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([7, 8, 9]),
    );
  });

  it("refuses a range past the end with 416", async () => {
    const response = await call(request("bytes=99-"));
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
    expect(await response.text()).toBe("");
  });

  it("answers 304 when the client already has this version", async () => {
    const response = await call(request(undefined, '"1-10"'));
    expect(response.status).toBe(304);
    expect(response.headers.get("cache-control")).toContain("immutable");
  });

  it("answers 404 when the row exists but the file does not", async () => {
    const missing = Object.assign(
      async () => ({
        ok: true as const,
        data: { ...source, filePath: path.join(root, "gone.mp4") },
      }),
      { operationName: "media.read", access: "anonymous" as const },
    );
    const response = await mediaRoute(missing)(request(), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });
});
