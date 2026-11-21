// SPEC: docs/features/payment-proof — an image is checked from its content, stored on the volume, and stops the countdown; a second upload adds another proof; staff read the file and never the public
// ROADMAP: phase-3-booking / payment-proof / Implement proof upload endpoint: type and size checks, store on volume, stop countdown
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import { booking, occasion, paymentProof } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { MAX_PROOF_BYTES } from "@/lib/proof-api";
import { openTestDb, resetDatabase } from "@/test/db";
import { aBooking, anOccasion } from "@/test/factories";
import { resolveProofPath } from "@/storage/proofs";

import { createProofOperations, sniffProofImage } from "./proof";

const handle = openTestDb();
const { db } = handle;

const NOW = new Date("2026-12-20T08:00:00Z");
const DEADLINE = new Date(NOW.getTime() + 20 * 60_000);
let now = NOW;
let root = "";
const clock: Clock = { now: () => now };
const holder = {
  ...createCallContext({ kind: "anonymous" }),
  clock,
};
const staff = {
  ...createCallContext({ kind: "staff", userId: "staff-1", role: "staff" }),
  clock,
};
const ops = createProofOperations(() => ({ db, uploadDir: root }));

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2,
]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP"),
]);

function aFile(bytes: Uint8Array, name: string, type: string): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy], name, { type });
}

let bookingId = 1;

async function seedHeld(overrides: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(booking)
    .values(
      aBooking({
        occasionId: 1,
        accessToken: "token-held",
        status: "held",
        startsAt: new Date("2026-12-25T16:00:00Z"),
        endsAt: new Date("2026-12-25T18:00:00Z"),
        holdExpiresAt: DEADLINE,
        ...overrides,
      }),
    )
    .returning({ id: booking.id });
  bookingId = row!.id;
  return row!.id;
}

async function proofRows() {
  return db.select().from(paymentProof).orderBy(paymentProof.id);
}

async function storedBooking() {
  const [row] = await db
    .select()
    .from(booking)
    .where(eq(booking.id, bookingId));
  return row!;
}

beforeEach(async () => {
  now = NOW;
  await resetDatabase(handle);
  await db.insert(occasion).values(anOccasion({ priceEgp: 1000 }));
  root = await mkdtemp(path.join(tmpdir(), "wesal-proof-ops-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("sniffProofImage", () => {
  it("recognizes JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffProofImage(JPEG)).toBe("image/jpeg");
    expect(sniffProofImage(PNG)).toBe("image/png");
    expect(sniffProofImage(WEBP)).toBe("image/webp");
  });

  it("rejects anything else, however it is named", () => {
    expect(sniffProofImage(Buffer.from("not an image"))).toBeNull();
    expect(sniffProofImage(Buffer.alloc(0))).toBeNull();
  });
});

describe("bookings.proof", () => {
  it("stores the picture, records the proof and stops the clock", async () => {
    await seedHeld();

    const result = await ops.upload(
      { token: "token-held", file: aFile(PNG, "receipt.png", "image/png") },
      holder,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      status: "proof_submitted",
      uploadedAt: NOW.toISOString(),
    });

    const [proof] = await proofRows();
    expect(proof).toMatchObject({
      bookingId,
      receivedVia: "upload",
      purgedAt: null,
      uploadedAt: NOW,
    });
    expect(proof?.filePath).toMatch(/^proofs\/[a-z0-9]+-[a-f0-9]{16}\.png$/);

    const stored = await readFile(resolveProofPath(root, proof!.filePath!));
    expect(stored.equals(PNG)).toBe(true);

    const row = await storedBooking();
    expect(row.status).toBe("proof_submitted");
    expect(row.holdExpiresAt).toBeNull();
    expect(row.updatedAt).toEqual(NOW);
  });

  it("trusts the content, not the file name or the browser's type", async () => {
    await seedHeld();

    const disguised = await ops.upload(
      { token: "token-held", file: aFile(PNG, "receipt.jpg", "image/jpeg") },
      holder,
    );
    expect(disguised.ok).toBe(true);
    const [proof] = await proofRows();
    expect(proof?.filePath).toMatch(/\.png$/);
  });

  it("refuses a file that is not an image", async () => {
    await seedHeld();

    const result = await ops.upload(
      {
        token: "token-held",
        file: aFile(Buffer.from("<html>no</html>"), "proof.png", "image/png"),
      },
      holder,
    );
    expect(result.ok ? undefined : result.error.code).toBe("INVALID_FILE");
    expect(await proofRows()).toHaveLength(0);
    expect((await storedBooking()).status).toBe("held");
  });

  it("refuses an empty file and anything over the size cap", async () => {
    await seedHeld();

    const empty = await ops.upload(
      {
        token: "token-held",
        file: aFile(Buffer.alloc(0), "proof.png", "image/png"),
      },
      holder,
    );
    expect(empty.ok ? undefined : empty.error.code).toBe("INVALID_FILE");

    const huge = await ops.upload(
      {
        token: "token-held",
        file: aFile(
          Buffer.alloc(MAX_PROOF_BYTES + 1),
          "proof.png",
          "image/png",
        ),
      },
      holder,
    );
    expect(huge.ok ? undefined : huge.error.code).toBe("FILE_TOO_LARGE");
    expect(await proofRows()).toHaveLength(0);
  });

  it("adds another proof when one is already awaiting review", async () => {
    await seedHeld({ status: "proof_submitted", holdExpiresAt: null });

    const first = await ops.upload(
      { token: "token-held", file: aFile(PNG, "one.png", "image/png") },
      holder,
    );
    now = new Date(NOW.getTime() + 60_000);
    const second = await ops.upload(
      { token: "token-held", file: aFile(JPEG, "two.jpg", "image/jpeg") },
      holder,
    );

    expect(first.ok && second.ok).toBe(true);
    const proofs = await proofRows();
    expect(proofs).toHaveLength(2);
    expect(proofs[0]?.filePath).not.toBe(proofs[1]?.filePath);
    expect((await storedBooking()).status).toBe("proof_submitted");
  });

  it("refuses an unknown link", async () => {
    await seedHeld();
    const result = await ops.upload(
      { token: "not-a-token", file: aFile(PNG, "proof.png", "image/png") },
      holder,
    );
    expect(result.ok ? undefined : result.error.code).toBe("NOT_FOUND");
  });

  it("refuses a hold past its deadline and marks it expired", async () => {
    await seedHeld();
    now = new Date(DEADLINE.getTime() + 1000);

    const result = await ops.upload(
      { token: "token-held", file: aFile(PNG, "proof.png", "image/png") },
      holder,
    );
    expect(result.ok ? undefined : result.error.code).toBe("HOLD_EXPIRED");
    expect(await proofRows()).toHaveLength(0);
    expect((await storedBooking()).status).toBe("expired");
  });

  it("refuses a booking staff already decided", async () => {
    await seedHeld({ status: "confirmed", holdExpiresAt: null });
    const result = await ops.upload(
      { token: "token-held", file: aFile(PNG, "proof.png", "image/png") },
      holder,
    );
    expect(result.ok ? undefined : result.error.code).toBe("HOLD_EXPIRED");
    expect(result.ok ? undefined : result.error.details?.status).toBe(
      "confirmed",
    );
    expect((await storedBooking()).status).toBe("confirmed");
  });

  it("tells the customer to retry or use WhatsApp when the volume cannot be written", async () => {
    await seedHeld();
    // A plain file where the volume directory should be: mkdir fails.
    root = path.join(
      await mkdtemp(path.join(tmpdir(), "wesal-not-a-dir-")),
      "file",
    );
    await writeFile(root, "x");

    const result = await ops.upload(
      { token: "token-held", file: aFile(PNG, "proof.png", "image/png") },
      holder,
    );
    expect(result.ok ? undefined : result.error.code).toBe(
      "SERVICE_UNAVAILABLE",
    );
    expect(await proofRows()).toHaveLength(0);
    expect((await storedBooking()).status).toBe("held");
  });
});

describe("staff.proofs.file", () => {
  async function uploadOne(): Promise<number> {
    await seedHeld();
    const result = await ops.upload(
      { token: "token-held", file: aFile(PNG, "proof.png", "image/png") },
      holder,
    );
    if (!result.ok) throw new Error("upload failed");
    return result.data.proofId;
  }

  it("serves the stored image to a staff session", async () => {
    const id = await uploadOne();
    const result = await ops.staffFile({ id }, staff);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.contentType).toBe("image/png");
    expect(result.data.fileName).toBe(`proof-${id}.png`);
    expect(Buffer.from(result.data.bytes).equals(PNG)).toBe(true);
  });

  it("refuses anonymous callers and a missing proof", async () => {
    const id = await uploadOne();
    const anon = await ops.staffFile({ id }, holder);
    expect(anon.ok ? undefined : anon.error.code).toBe("UNAUTHENTICATED");

    const missing = await ops.staffFile({ id: 9999 }, staff);
    expect(missing.ok ? undefined : missing.error.code).toBe("NOT_FOUND");
  });

  it("reports a purged or lost file as no longer available", async () => {
    const id = await uploadOne();
    const [proof] = await proofRows();

    await db
      .update(paymentProof)
      .set({ purgedAt: now })
      .where(eq(paymentProof.id, id));
    const purged = await ops.staffFile({ id }, staff);
    expect(purged.ok ? undefined : purged.error.code).toBe("NOT_FOUND");

    await db
      .update(paymentProof)
      .set({ purgedAt: null })
      .where(eq(paymentProof.id, id));
    await unlink(resolveProofPath(root, proof!.filePath!));
    const lost = await ops.staffFile({ id }, staff);
    expect(lost.ok ? undefined : lost.error.code).toBe("NOT_FOUND");
  });
});
