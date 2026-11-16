// SPEC: message-delivery/spec.md — POST /api/v1/webhooks/twilio/status: signature-checked callbacks
// ROADMAP: phase-2-foundations / message-delivery / Implement Twilio status webhook with signature check and SMS fallback
import { describe, expect, it } from "vitest";

import { readFormParams } from "./form-params";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://wesal.example/x", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...headers,
    },
  });

describe("readFormParams", () => {
  it("parses a form body into plain parameters", async () => {
    expect(
      await readFormParams(
        post("MessageSid=SM1&MessageStatus=delivered&To=%2B20"),
      ),
    ).toEqual({ MessageSid: "SM1", MessageStatus: "delivered", To: "+20" });
  });

  it("accepts an empty body", async () => {
    expect(
      await readFormParams(
        new Request("https://x.example/", { method: "POST" }),
      ),
    ).toEqual({});
  });

  it("refuses a body over the limit, declared or streamed", async () => {
    await expect(
      readFormParams(post("a=1", { "content-length": "99999" }), 100),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      readFormParams(post("a=" + "x".repeat(500)), 100),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
