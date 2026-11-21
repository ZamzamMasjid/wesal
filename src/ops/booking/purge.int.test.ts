// SPEC: docs/architecture/data-model.md — Retention: screenshots live for one day, never while the booking still awaits review, and the row stays with `purged_at` stamped
// ROADMAP: phase-3-booking / payment-proof / Implement daily purge of proof files older than one day
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { booking, occasion, paymentProof } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { aBooking, anOccasion } from "@/test/factories";
import { createFakeClock, type FakeClock } from "@/test/fake-clock";
import { openTestDb, resetDatabase } from "@/test/db";
import { resolveProofPath, writeProof } from "@/storage/proofs";

import {
  createDailyProofPurge,
  PROOF_RETENTION_MS,
  purgeOldProofs,
} from "./purge";

const handle = openTestDb();
const { db } = handle;

const START = new Date("2026-12-20T08:00:00Z");
let clock: FakeClock = createFakeClock(START);
let root = "";
const deps = () => ({ db, clock: clock as Clock, uploadDir: root });

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1]);

let slot = 0;
async function seedProof(options: {
  bookingStatus: "held" | "proof_submitted" | "confirmed";
  uploadedAt: Date;
  filePath?: string | null;
  purgedAt?: Date | null;
}) {
  const startsAt = new Date(START.getTime() + slot++ * 3 * 60 * 60_000);
  const [row] = await db
    .insert(booking)
    .values(
      aBooking({
        occasionId: 1,
        publicId: `P${slot}`,
        accessToken: `token-${slot}`,
        status: options.bookingStatus,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 60 * 60_000),
        holdExpiresAt: null,
      }),
    )
    .returning({ id: booking.id });

  let filePath = options.filePath;
  if (filePath === undefined) {
    filePath = (await writeProof(root, PNG, "png", options.uploadedAt))
      .filePath;
  }

  const [proof] = await db
    .insert(paymentProof)
    .values({
      bookingId: row!.id,
      filePath,
      receivedVia: filePath ? "upload" : "whatsapp",
      uploadedAt: options.uploadedAt,
      purgedAt: options.purgedAt ?? null,
    })
    .returning({ id: paymentProof.id });

  return { bookingId: row!.id, proofId: proof!.id, filePath };
}

async function proofRow(id: number) {
  const [row] = await db
    .select()
    .from(paymentProof)
    .where(eq(paymentProof.id, id));
  return row!;
}

beforeEach(async () => {
  clock = createFakeClock(START);
  slot = 0;
  await resetDatabase(handle);
  await db.insert(occasion).values(anOccasion());
  root = await mkdtemp(path.join(tmpdir(), "wesal-purge-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("purgeOldProofs", () => {
  it("deletes a file older than a day once the booking has left review", async () => {
    const { proofId, filePath } = await seedProof({
      bookingStatus: "confirmed",
      uploadedAt: new Date(START.getTime() - PROOF_RETENTION_MS - 60_000),
    });

    const summary = await purgeOldProofs(deps());

    expect(summary).toEqual({ purged: 1, failed: 0 });
    const row = await proofRow(proofId);
    expect(row.purgedAt).toEqual(START);
    await expect(readFile(resolveProofPath(root, filePath!))).rejects.toThrow();
  });

  it("never deletes a file while the booking still awaits review", async () => {
    const { proofId, filePath } = await seedProof({
      bookingStatus: "proof_submitted",
      uploadedAt: new Date(START.getTime() - 5 * PROOF_RETENTION_MS),
    });

    expect(await purgeOldProofs(deps())).toEqual({ purged: 0, failed: 0 });
    expect((await proofRow(proofId)).purgedAt).toBeNull();
    await expect(
      readFile(resolveProofPath(root, filePath!)),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it("keeps a file younger than a day", async () => {
    await seedProof({
      bookingStatus: "confirmed",
      uploadedAt: new Date(START.getTime() - 23 * 60 * 60_000),
    });

    expect(await purgeOldProofs(deps())).toEqual({ purged: 0, failed: 0 });
  });

  it("leaves an already purged row and a WhatsApp proof alone", async () => {
    const already = await seedProof({
      bookingStatus: "confirmed",
      uploadedAt: new Date(START.getTime() - 3 * PROOF_RETENTION_MS),
      purgedAt: new Date(START.getTime() - PROOF_RETENTION_MS),
    });
    const whatsapp = await seedProof({
      bookingStatus: "confirmed",
      uploadedAt: new Date(START.getTime() - 3 * PROOF_RETENTION_MS),
      filePath: null,
    });

    expect(await purgeOldProofs(deps())).toEqual({ purged: 0, failed: 0 });
    expect((await proofRow(already.proofId)).purgedAt).not.toBeNull();
    expect((await proofRow(whatsapp.proofId)).purgedAt).toBeNull();
  });

  it("keeps the row unstamped when the file cannot be deleted, and retries later", async () => {
    const { proofId, filePath } = await seedProof({
      bookingStatus: "confirmed",
      uploadedAt: new Date(START.getTime() - PROOF_RETENTION_MS - 60_000),
    });
    // A directory where the file should be: unlink fails on every platform, so
    // the row must stay unstamped and the next run must try again.
    const absolute = resolveProofPath(root, filePath!);
    await rm(absolute);
    await mkdir(absolute);

    const failed = await purgeOldProofs(deps());
    expect(failed).toEqual({ purged: 0, failed: 1 });
    expect((await proofRow(proofId)).purgedAt).toBeNull();

    await rm(absolute, { recursive: true });
    await writeFile(absolute, PNG);
    const retried = await purgeOldProofs(deps());
    expect(retried).toEqual({ purged: 1, failed: 0 });
    expect((await proofRow(proofId)).purgedAt).toEqual(START);
    await expect(readFile(absolute)).rejects.toThrow();
  });
});

describe("createDailyProofPurge", () => {
  it("runs on the first wake-up and then at most once a day", async () => {
    await seedProof({
      bookingStatus: "confirmed",
      uploadedAt: new Date(START.getTime() - PROOF_RETENTION_MS - 60_000),
    });
    const run = createDailyProofPurge(clock, () => purgeOldProofs(deps()));

    expect(await run()).toEqual({ purged: 1, failed: 0 });
    clock.advance(60 * 60_000);
    expect(await run()).toBeNull();
    clock.advance(PROOF_RETENTION_MS);
    expect(await run()).toEqual({ purged: 0, failed: 0 });
  });
});
