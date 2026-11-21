// SPEC: docs/features/payment-proof/spec.md — a held booking's page offers the screenshot upload; sending one stores it, stops the countdown and shows "awaiting review"; the staff file endpoint is not public
// ROADMAP: phase-3-booking / payment-proof / Implement upload UI and WhatsApp button prefilled with the booking ID
// Needs the local database (`npm run db:up`) and, if present, `.env.local` for DATABASE_URL.
// The test seeds its own held booking and removes it (and its files) afterwards.
import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

const PUBLIC_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const line = env
      .split(/\r?\n/)
      .find((candidate) => /^\s*DATABASE_URL\s*=/.test(candidate));
    const value = line?.slice(line.indexOf("=") + 1).trim();
    if (value) return value.replace(/^["']|["']$/g, "");
  } catch {
    // No .env.local: the documented development default applies.
  }
  return "postgres://wesal:wesal@localhost:5432/wesal";
}

function uploadDir(): string {
  return (
    process.env.UPLOAD_DIR?.trim() || path.join(process.cwd(), "db", "uploads")
  );
}

function publicId(): string {
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += PUBLIC_ID_ALPHABET[randomInt(PUBLIC_ID_ALPHABET.length)];
  }
  return id;
}

let client: Client;
let bookingId = 0;
let bookingToken = "";

test.beforeAll(async () => {
  client = new Client({ connectionString: databaseUrl() });
  await client.connect();

  // Clean an earlier interrupted run before seeding this one.
  await client.query(
    "delete from booking where access_token like 'e2e-proof-%'",
  );

  let occasionId: number | undefined = (
    await client.query("select id from occasion order by id limit 1")
  ).rows[0]?.id;
  if (!occasionId) {
    occasionId = (
      await client.query(
        `insert into occasion (name_ar, name_en, price_egp)
         values ('اختبار', 'E2E occasion', 15000) returning id`,
      )
    ).rows[0].id;
  }

  bookingToken = `e2e-proof-${randomUUID()}`;
  bookingId = (
    await client.query(
      `insert into booking (
         public_id, access_token, occasion_id, starts_at, ends_at, status,
         source, customer_name, customer_phone, locale, price_egp, deposit_egp,
         hold_expires_at
       ) values ($1, $2, $3, $4, $5, 'held', 'online', 'E2E Mona',
                 '+201001234567', 'en', 15000, 7500, now() + interval '20 minutes')
       returning id`,
      [
        publicId(),
        bookingToken,
        occasionId,
        "2029-01-01T16:00:00Z",
        "2029-01-01T18:00:00Z",
      ],
    )
  ).rows[0].id;
});

test.afterAll(async () => {
  if (!client) return;
  const proofs = await client.query(
    "select file_path from payment_proof where booking_id = $1",
    [bookingId],
  );
  for (const row of proofs.rows) {
    if (!row.file_path) continue;
    await unlink(path.join(uploadDir(), row.file_path)).catch(() => undefined);
  }
  await client.query("delete from booking where id = $1", [bookingId]);
  await client.end();
});

async function openBooking(page: Page, locale: "ar" | "en") {
  const prefix = locale === "en" ? "/en" : "";
  await page.goto(`${prefix}/booking/${bookingToken}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("payment proof", () => {
  test("a held booking offers the upload and its countdown", async ({
    page,
  }) => {
    await openBooking(page, "en");

    await expect(
      page.getByRole("heading", { name: "Your booking" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Payment proof" }),
    ).toBeVisible();
    await expect(
      page.locator("button", { hasText: "Upload transfer screenshot" }),
    ).toBeVisible();
    await expect(page.getByRole("timer")).toBeVisible();
  });

  test("uploading a screenshot stops the countdown and awaits review", async ({
    page,
  }) => {
    await openBooking(page, "en");

    const upload = page.waitForResponse(
      (response) =>
        response.url().includes(`/bookings/by-token/${bookingToken}/proof`) &&
        response.request().method() === "POST",
    );
    await page.setInputFiles('input[type="file"]', {
      name: "proof.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(
      page.getByAltText("Preview of the chosen screenshot"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Send screenshot" }).click();

    expect((await upload).status()).toBe(201);
    await expect(
      page.getByRole("heading", { name: "Awaiting review" }),
    ).toBeVisible();
    await expect(page.getByRole("timer")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(
      "We received your screenshot.",
    );

    const booking = (
      await client.query(
        "select status, hold_expires_at from booking where id = $1",
        [bookingId],
      )
    ).rows[0];
    expect(booking.status).toBe("proof_submitted");
    expect(booking.hold_expires_at).toBeNull();

    const proofs = await client.query(
      "select id, file_path from payment_proof where booking_id = $1",
      [bookingId],
    );
    expect(proofs.rows).toHaveLength(1);
    const proof = proofs.rows[0];
    expect((await stat(path.join(uploadDir(), proof.file_path))).isFile()).toBe(
      true,
    );

    // The screenshot is served only behind a staff session (ADR-013).
    const denied = await page.request.get(
      `/api/v1/staff/proofs/${proof.id}/file`,
    );
    expect(denied.status()).toBe(401);
    expect((await denied.json()).error.code).toBe("UNAUTHENTICATED");
  });

  test("the Arabic page is right-to-left and offers another screenshot", async ({
    page,
  }) => {
    await openBooking(page, "ar");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "صورة إضافية" }),
    ).toBeVisible();
    await expect(
      page.locator("button", { hasText: "ارفع صورة أخرى" }),
    ).toBeVisible();
  });
});
