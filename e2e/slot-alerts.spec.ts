// SPEC: slot-alerts/spec.md — a visitor watching a taken slot verifies a phone and is told when it frees up
// ROADMAP: phase-6-alerts-and-reports / slot-alerts / Implement alert signup on a taken slot with phone verification
// Needs the local database and the dev seed. The test inserts its own held
// booking on a free upcoming Friday, seeds the verification code directly (the
// log sender has no inbox), and removes its rows afterwards.
import { createHmac, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { Client } from "pg";

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

/** The next Friday at 18:00-22:00 Cairo that no active booking holds. */
async function aFreeFriday(client: Client): Promise<string> {
  let day = cairoToday();
  while (new Date(`${day}T00:00:00Z`).getUTCDay() !== 5) day = addDays(day, 1);
  for (let week = 0; week < 12; week++) {
    const start = `${day}T16:00:00Z`; // 18:00 Cairo in winter
    const end = `${day}T20:00:00Z`; // 22:00 Cairo
    const taken = await client.query(
      `select 1 from booking
        where status in ('held', 'proof_submitted', 'confirmed')
          and starts_at < $2 and ends_at > $1 limit 1`,
      [start, end],
    );
    if (taken.rowCount === 0) return day;
    day = addDays(day, 7);
  }
  throw new Error("No free Friday slot in the next 12 weeks.");
}

let client: Client;
const phone = aPhone();
let publicId = "";
let day = "";

test.beforeAll(async () => {
  client = new Client({
    connectionString:
      envValue("DATABASE_URL") ?? "postgres://wesal:wesal@localhost:5432/wesal",
  });
  await client.connect();
  const occasions = await client.query("select id from occasion limit 1");
  const occasionId = occasions.rows[0]?.id as number | undefined;
  if (!occasionId) throw new Error("Run `npm run db:seed` first.");
  day = await aFreeFriday(client);
  publicId = `AL${Date.now().toString(36).toUpperCase().slice(-6)}`;
  await client.query(
    `insert into booking
       (public_id, access_token, occasion_id, starts_at, ends_at, status, source,
        customer_name, customer_phone, locale, price_egp, deposit_egp, hold_expires_at)
     values ($1, $2, $3, $4, $5, 'held', 'online',
        'Alert E2E', '+201000008888', 'ar', 15000, 7500, now() + interval '1 day')`,
    [publicId, `token-${publicId}`, occasionId, `${day}T16:00:00Z`, `${day}T20:00:00Z`],
  );
});

test.afterAll(async () => {
  await client.query("delete from slot_alert where phone = $1", [phone]);
  await client.query("delete from phone_verification where phone = $1", [
    phone,
  ]);
  await client.query("delete from booking where public_id = $1", [publicId]);
  await client.end();
});

test("a visitor subscribes to a taken slot after the code check", async ({
  page,
}) => {
  // VIEW: slot-alert-signup.md § Default and after code
  await page.goto(`/en/calendar?day=${day}`);
  const notify = page.getByRole("button", {
    name: /Notify me if the 6:00/,
  });
  await expect(notify).toBeVisible();
  await notify.click();

  await expect(
    page.getByRole("dialog").getByText("Notify me if this slot frees up"),
  ).toBeVisible();
  await page.getByRole("dialog").locator('input[type="tel"]').fill(phone);
  const requested = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/verification/request") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send code" }).click();
  expect((await requested).status()).toBe(200);

  // The provider logs the code instead of sending it; seed the same code the
  // customer would have received so the check can pass.
  const codeHash = createHmac("sha256", verificationSecret())
    .update(`${phone}:${CODE}`)
    .digest("hex");
  await client.query("delete from phone_verification where phone = $1", [
    phone,
  ]);
  await client.query(
    `insert into phone_verification (phone, code_hash, expires_at, attempts, created_at)
     values ($1, $2, now() + interval '5 minutes', 0, now() + interval '2 seconds')`,
    [phone, codeHash],
  );

  await page.locator('input[autocomplete="one-time-code"]').fill(CODE);
  await expect(
    page.getByRole("dialog").getByText("You will be notified", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("dialog").getByText(
      `We will message ${phone} if this slot frees up.`,
    ),
  ).toBeVisible();

  const stored = await client.query(
    "select locale, notified_at from slot_alert where phone = $1",
    [phone],
  );
  expect(stored.rowCount).toBe(1);
  expect(stored.rows[0].notified_at).toBeNull();

  await page.getByRole("button", { name: "Back to calendar" }).click();
  await expect(page.getByText("You will be notified", { exact: true })).toBeVisible();
});
