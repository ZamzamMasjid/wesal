// SPEC: docs/features/landing-page — a family goes from the home page to an uploaded payment proof without calling, in Arabic and English
// ROADMAP: phase-5-public-site / landing-page / Write e2e test: booking journey from home to uploaded proof in both languages
// Needs the local database (`npm run db:up`), the dev seed and, if present, `.env.local`.
// The test uses a fresh phone per language, seeds its own verification code, and removes its bookings and files.
import { createHmac, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { Client } from "pg";

import ar from "../messages/ar.json";
import en from "../messages/en.json";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const CODE = "123456";

function envValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const file = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const line = file
      .split(/\r?\n/)
      .find((candidate) => new RegExp(`^\\s*${name}\\s*=`).test(candidate));
    const value = line?.slice(line.indexOf("=") + 1).trim();
    return value ? value.replace(/^["']|["']$/g, "") : undefined;
  } catch {
    return undefined;
  }
}

function databaseUrl(): string {
  return (
    envValue("DATABASE_URL") ?? "postgres://wesal:wesal@localhost:5432/wesal"
  );
}

function uploadDir(): string {
  return (
    envValue("UPLOAD_DIR")?.trim() || path.join(process.cwd(), "db", "uploads")
  );
}

function verificationSecret(): string {
  const secret =
    envValue("VERIFICATION_TOKEN_SECRET") ?? envValue("BETTER_AUTH_SECRET");
  if (!secret) throw new Error("VERIFICATION_TOKEN_SECRET is not set.");
  return secret;
}

function aPhone(): string {
  let digits = "+2010";
  for (let i = 0; i < 8; i++) digits += String(randomInt(0, 10));
  return digits;
}

function codeHash(phone: string): string {
  return createHmac("sha256", verificationSecret())
    .update(`${phone}:${CODE}`)
    .digest("hex");
}

interface FreeSlot {
  day: string;
  start: string;
  end: string;
}

function cairoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
  }).format(new Date());
}

function addDays(day: string, days: number): string {
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

let client: Client;
const phones: string[] = [];

test.beforeAll(async () => {
  client = new Client({ connectionString: databaseUrl() });
  await client.connect();

  // The seed is normally present; make the journey self-sufficient if it is not.
  const occasions = await client.query(
    "select count(*)::int as n from occasion",
  );
  if (occasions.rows[0].n === 0) {
    await client.query(
      `insert into occasion (name_ar, name_en, price_egp)
       values ('زفاف', 'Wedding', 15000)`,
    );
  }
  const pattern = await client.query(
    "select count(*)::int as n from slot_pattern",
  );
  if (pattern.rows[0].n === 0) {
    await client.query(
      `insert into slot_pattern (weekday, start_time, end_time)
       select day, '18:00', '21:00' from generate_series(0, 6) as day`,
    );
  }
});

test.afterAll(async () => {
  if (!client) return;
  if (phones.length > 0) {
    const proofs = await client.query(
      `select pp.file_path
         from payment_proof pp
         join booking b on b.id = pp.booking_id
        where b.customer_phone = any($1::text[])`,
      [phones],
    );
    for (const row of proofs.rows) {
      if (!row.file_path) continue;
      await unlink(path.join(uploadDir(), row.file_path)).catch(
        () => undefined,
      );
    }
    await client.query(
      "delete from booking where customer_phone = any($1::text[])",
      [phones],
    );
    await client.query(
      "delete from phone_verification where phone = any($1::text[])",
      [phones],
    );
  }
  await client.end();
});

async function firstFreeSlot(request: APIRequestContext): Promise<FreeSlot> {
  const from = cairoToday();
  const to = addDays(from, 60);
  const response = await request.get(
    `/api/v1/availability?from=${from}&to=${to}`,
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  for (const day of body.data.days as {
    day: string;
    slots: { start: string; end: string; action: string }[];
  }[]) {
    const slot = day.slots.find((entry) => entry.action === "book");
    if (slot) return { day: day.day, start: slot.start, end: slot.end };
  }
  throw new Error("No bookable slot in the next 60 days.");
}

async function seedVerification(phone: string) {
  await client.query(
    `insert into phone_verification (phone, code_hash, expires_at, attempts, created_at)
     values ($1, $2, now() + interval '5 minutes', 0, now() + interval '2 seconds')`,
    [phone, codeHash(phone)],
  );
}

async function journey(
  page: Page,
  request: APIRequestContext,
  locale: "ar" | "en",
) {
  const text = locale === "ar" ? ar : en;
  const prefix = locale === "en" ? "/en" : "";
  const phone = aPhone();
  phones.push(phone);

  // 1. The family starts on the home page and picks an occasion.
  await page.goto(`${prefix}/`);
  await expect(
    page.getByRole("heading", { level: 1, name: text.Home.venueName }),
  ).toBeVisible();

  const card = page.locator('main a[href*="occasion="]').first();
  await expect(card).toBeVisible();
  const href = await card.getAttribute("href");
  const occasion = Number(
    new URL(href ?? "", "http://x").searchParams.get("occasion"),
  );
  expect(Number.isInteger(occasion) && occasion > 0).toBe(true);
  await card.click();
  await expect(page).toHaveURL(/\/calendar/);

  // 2. Open a day with a free slot and book it.
  const slot = await firstFreeSlot(request);
  await page.goto(`${prefix}/calendar?day=${slot.day}&occasion=${occasion}`);
  const bookLink = page
    .locator(`main a[href*="start=${encodeURIComponent(slot.start)}"]`)
    .first();
  await expect(bookLink).toBeVisible();
  await bookLink.click();
  await expect(page).toHaveURL(/\/book\?/);

  // The occasion survived the calendar into the form.
  await expect(page.locator('input[name="occasion"]:checked')).toHaveCount(1);

  await page
    .locator('input[name="name"]')
    .fill(locale === "ar" ? "منى للاختبار" : "E2E Mona");
  await page.locator('input[name="phone"]').fill(phone.replace(/^\+20/, "0"));

  // 3. The code step opens and requests a code; give it one we know.
  const requested = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/verification/request") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: text.Booking.book }).click();
  expect((await requested).status()).toBe(200);
  await seedVerification(phone);

  const held = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/bookings") &&
      response.request().method() === "POST",
  );
  await page.locator('input[autocomplete="one-time-code"]').fill(CODE);
  const holdResponse = await held;
  expect(holdResponse.status()).toBe(201);

  await expect(
    page.getByRole("heading", { name: text.Booking.heldTitle }),
  ).toBeVisible();

  // 4. Open the private booking page and upload the transfer screenshot.
  await page.getByRole("link", { name: text.Booking.heldOpen }).click();
  await expect(page).toHaveURL(/\/booking\//);
  await expect(
    page.getByRole("heading", { name: text.BookingPage.title }),
  ).toBeVisible();

  const uploaded = page.waitForResponse(
    (response) =>
      response.url().includes("/proof") &&
      response.request().method() === "POST",
  );
  await page.setInputFiles('input[type="file"]', {
    name: "proof.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page
    .getByRole("button", { name: text.BookingPage.upload.send })
    .click();
  expect((await uploaded).status()).toBe(201);

  await expect(
    page.getByRole("heading", {
      name: text.BookingPage.statusTitle.proof_submitted,
    }),
  ).toBeVisible();
  await expect(page.getByText(text.BookingPage.upload.received)).toBeVisible();

  // 5. The booking is awaiting review in the database, with its file.
  const row = (
    await client.query(
      "select id, status from booking where customer_phone = $1",
      [phone],
    )
  ).rows[0];
  expect(row.status).toBe("proof_submitted");
  const proofs = await client.query(
    "select count(*)::int as n from payment_proof where booking_id = $1",
    [row.id],
  );
  expect(proofs.rows[0].n).toBe(1);
}

for (const locale of ["ar", "en"] as const) {
  test(`booking journey from home to uploaded proof (${locale})`, async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    await journey(page, request, locale);
  });
}
