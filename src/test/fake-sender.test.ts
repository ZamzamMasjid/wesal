// SPEC: docs/architecture/testing.md — Twilio is never called; the fake sender records and can fail a channel
// ROADMAP: phase-1-infrastructure / testing / Add test scaffold under src/test: factories, database helper, fake clock, fake sender
import { describe, expect, it } from "vitest";

import { createFakeSender } from "./fake-sender";

describe("fake sender", () => {
  it("records sent messages", async () => {
    const s = createFakeSender();
    const r = await s.send({ channel: "whatsapp", to: "+201", body: "hi" });
    expect(r.providerMessageId).toBe("fake-1");
    expect(s.sent).toHaveLength(1);
  });

  it("fails a channel until recovered, leaving other channels working", async () => {
    const s = createFakeSender();
    s.failChannel("whatsapp");
    await expect(
      s.send({ channel: "whatsapp", to: "x", body: "b" }),
    ).rejects.toThrow("whatsapp delivery failed");
    await expect(
      s.send({ channel: "sms", to: "x", body: "b" }),
    ).resolves.toBeDefined();
    s.recover("whatsapp");
    await expect(
      s.send({ channel: "whatsapp", to: "x", body: "b" }),
    ).resolves.toBeDefined();
    s.reset();
    expect(s.sent).toHaveLength(0);
  });
});
