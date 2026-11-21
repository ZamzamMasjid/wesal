// SPEC: docs/features/payment-proof — the browser sends one image, shows upload progress, and turns a stable error code into one next step
// ROADMAP: phase-3-booking / payment-proof / Implement upload UI and WhatsApp button prefilled with the booking ID
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_PROOF_BYTES,
  looksLikeProof,
  proofEndpoint,
  proofSizeLabel,
  uploadProof,
  type ProofUploaded,
} from "./proof-api";

const uploaded: ProofUploaded = {
  status: "proof_submitted",
  proofId: 7,
  uploadedAt: "2026-12-20T08:00:00.000Z",
};

class FakeXhr {
  static current: FakeXhr | undefined;

  upload: {
    onprogress?: (event: {
      lengthComputable: boolean;
      loaded: number;
      total: number;
    }) => void;
  } = {};
  responseType = "";
  response: unknown = null;
  responseText = "";
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  open = vi.fn();
  send = vi.fn();
  body: FormData | undefined;

  constructor() {
    FakeXhr.current = this;
  }

  finish(body: unknown, text = "") {
    this.response = body;
    this.responseText = text;
    this.onload?.();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeXhr.current = undefined;
});

describe("proof upload envelope", () => {
  it("accepts only the three image types", () => {
    expect(looksLikeProof({ type: "image/png" })).toBe(true);
    expect(looksLikeProof({ type: "image/jpeg" })).toBe(true);
    expect(looksLikeProof({ type: "image/webp" })).toBe(true);
    expect(looksLikeProof({ type: "image/heic" })).toBe(false);
    expect(looksLikeProof({ type: "application/pdf" })).toBe(false);
  });

  it("writes a size a person reads in both languages", () => {
    expect(MAX_PROOF_BYTES).toBe(10 * 1024 * 1024);
    expect(proofSizeLabel(MAX_PROOF_BYTES, "en")).toBe("10 MB");
    expect(proofSizeLabel(512, "ar")).toBe("1 KB");
    expect(proofSizeLabel(2.4 * 1024 * 1024, "en")).toBe("2.4 MB");
  });

  it("escapes the token in the endpoint", () => {
    expect(proofEndpoint("a/b c")).toBe(
      "/api/v1/bookings/by-token/a%2Fb%20c/proof",
    );
  });
});

describe("uploadProof", () => {
  it("posts the file as multipart and reports progress", async () => {
    vi.stubGlobal(
      "XMLHttpRequest",
      FakeXhr as unknown as typeof XMLHttpRequest,
    );
    const onProgress = vi.fn();
    const file = new File([new Uint8Array([1, 2, 3])], "proof.png", {
      type: "image/png",
    });

    const pending = uploadProof("token-one", file, onProgress);
    const request = FakeXhr.current!;
    expect(request.open).toHaveBeenCalledWith(
      "POST",
      "/api/v1/bookings/by-token/token-one/proof",
    );
    request.upload.onprogress?.({
      lengthComputable: true,
      loaded: 4,
      total: 8,
    });
    expect(onProgress).toHaveBeenCalledWith(0.5);
    request.finish({ ok: true, data: uploaded });

    await expect(pending).resolves.toEqual({ ok: true, data: uploaded });
    expect(request.send).toHaveBeenCalledTimes(1);
  });

  it("parses a text answer when the browser leaves the response unset", async () => {
    vi.stubGlobal(
      "XMLHttpRequest",
      FakeXhr as unknown as typeof XMLHttpRequest,
    );
    const pending = uploadProof(
      "token-one",
      new File([new Uint8Array([1])], "proof.png", { type: "image/png" }),
    );
    FakeXhr.current!.finish(null, JSON.stringify({ ok: true, data: uploaded }));
    await expect(pending).resolves.toEqual({ ok: true, data: uploaded });
  });

  it("reports a refused code and a network failure", async () => {
    vi.stubGlobal(
      "XMLHttpRequest",
      FakeXhr as unknown as typeof XMLHttpRequest,
    );
    const refused = uploadProof(
      "token-one",
      new File([new Uint8Array([1])], "proof.png", { type: "image/png" }),
    );
    FakeXhr.current!.finish({
      ok: false,
      error: { code: "HOLD_EXPIRED" },
    });
    await expect(refused).resolves.toMatchObject({
      ok: false,
      error: { code: "HOLD_EXPIRED" },
    });

    const broken = uploadProof(
      "token-one",
      new File([new Uint8Array([1])], "proof.png", { type: "image/png" }),
    );
    FakeXhr.current!.onerror?.();
    await expect(broken).resolves.toMatchObject({
      ok: false,
      error: { code: "NETWORK" },
    });
  });

  it("falls back to fetch where XMLHttpRequest does not exist", async () => {
    vi.stubGlobal("XMLHttpRequest", undefined);
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ ok: true, data: uploaded }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadProof(
        "token-one",
        new File([new Uint8Array([1])], "proof.png", { type: "image/png" }),
      ),
    ).resolves.toEqual({ ok: true, data: uploaded });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
