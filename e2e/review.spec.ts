// SPEC: docs/features/payment-review — staff open a proof, confirm or reject it, and the queue moves on
// ROADMAP: phase-4-operations / payment-review / Write e2e test: staff reviews, confirms and rejects a booking
// Needs the dev seed (`npm run db:seed`): owner login with SEED_OWNER_PASSWORD or the default.
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

const OWNER = "owner";
const PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "owner-password";
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://wesal:wesal@localhost:5432/wesal";
const UPLOAD_ROOT =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "db", "uploads");

// A 1×1 PNG; the point is that the staff-only file endpoint serves it.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function aBookingCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

interface SeededBooking {
  code: string;
  file: string;
}

async function seedReview(
  code: string,
  dayOffset: number,
): Promise<SeededBooking> {
  const relative = `proofs/e2e-${code.toLowerCase()}.png`;
  const absolute = path.join(UPLOAD_ROOT, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, PNG);

  await withDb(async (client) => {
    const { rows } = await client.query(
      "select id, price_egp from occasion where active = true order by position, id limit 1",
    );
    const occasion = rows[0] as { id: number; price_egp: number } | undefined;
    if (!occasion) throw new Error("Seed the database: no active occasion.");

    const start = `2031-02-${String(1 + dayOffset).padStart(2, "0")} 16:00:00+02`;
    const end = `2031-02-${String(1 + dayOffset).padStart(2, "0")} 18:00:00+02`;
    const deposit = Math.round((occasion.price_egp * 50) / 100);

    const inserted = await client.query(
      `insert into booking
         (public_id, access_token, occasion_id, starts_at, ends_at, status,
          source, customer_name, customer_phone, locale, price_egp, deposit_egp,
          hold_expires_at, urgent, remainder_paid)
       values ($1, $2, $3, $4, $5, 'proof_submitted', 'online', 'E2E Customer',
               '+201009998877', 'en', $6, $7, null, false, false)
       returning id`,
      [
        code,
        `e2e-token-${code}`,
        occasion.id,
        start,
        end,
        occasion.price_egp,
        deposit,
      ],
    );
    await client.query(
      `insert into payment_proof (booking_id, file_path, received_via, uploaded_at)
       values ($1, $2, 'upload', now())`,
      [inserted.rows[0].id, relative],
    );
  });

  return { code, file: absolute };
}

async function cleanUp(bookings: SeededBooking[]): Promise<void> {
  await withDb(async (client) => {
    for (const { code } of bookings) {
      await client.query("delete from booking where public_id = $1", [code]);
    }
  });
  for (const { file } of bookings) {
    await unlink(file).catch(() => undefined);
  }
}

async function bookingStatus(code: string): Promise<string | null> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      "select status from booking where public_id = $1",
      [code],
    );
    return (rows[0] as { status: string } | undefined)?.status ?? null;
  });
}

async function loginToReview(page: Page, code: string) {
  await page.goto(`/en/dashboard/review/${code}`);
  await page.locator('input[name="username"]').fill(OWNER);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL(new RegExp(`/en/dashboard/review/${code}$`));
  await expect(page.getByText("Expected deposit")).toBeVisible();
}

test("staff reviews a proof, confirms one booking and rejects another", async ({
  page,
}) => {
  const confirmed = await seedReview(aBookingCode(), 1);
  const rejected = await seedReview(aBookingCode(), 4);

  try {
    await loginToReview(page, confirmed.code);

    // The screenshot is served by the staff-only endpoint, never a public URL.
    await expect(
      page.getByAltText(`Payment screenshot for booking ${confirmed.code}`),
    ).toBeVisible();

    const confirmResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/bookings/${confirmed.code}/confirm`) &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Confirm this payment?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm booking" }).click();
    expect((await confirmResponse).status()).toBe(200);
    await expect.poll(() => bookingStatus(confirmed.code)).toBe("confirmed");

    // A direct alert link opens the next booking even after the queue moved on.
    await page.goto(`/en/dashboard/review/${rejected.code}`);
    const rejectResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/bookings/${rejected.code}/reject`) &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    await page.getByLabel("No transfer found").check();
    await page.getByLabel("Note (optional)").fill("E2E: no transfer found");
    await page.getByRole("button", { name: "Reject booking" }).click();
    expect((await rejectResponse).status()).toBe(200);
    await expect.poll(() => bookingStatus(rejected.code)).toBe("rejected");

    // Reopening a decided booking says so instead of offering the actions.
    await page.goto(`/en/dashboard/review/${rejected.code}`);
    await expect(
      page.getByText("This booking is already Not confirmed."),
    ).toBeVisible();
  } finally {
    await cleanUp([confirmed, rejected]);
  }
});
