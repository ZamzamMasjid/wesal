// SPEC: docs/features/booking-management/spec.md â€” staff list every booking, enter a phone or walk-in booking, cancel it with a reason and mark the remainder paid, each with an audit row
// ROADMAP: phase-4-operations / booking-management / Implement phone/walk-in booking entry with conflict handling
// Needs the dev seed (`npm run db:seed`): owner login with SEED_OWNER_PASSWORD or the default.
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

const OWNER = "owner";
const PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "owner-password";
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://wesal:wesal@localhost:5432/wesal";

// Every row this spec creates carries this prefix, so a failed run can be swept
// up before the next one and nothing else in the dev database is touched.
const PREFIX = "E2E BM";
const ENTRY_DAY = "2031-03-03"; // A Monday: the seed's 10:00-14:00 slot.
const RACE_DAY = "2031-03-10"; // The next Monday, for the held-slot race.

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function purgeE2eBookings(): Promise<void> {
  await withDb(async (client) => {
    const { rows } = await client.query(
      "select id from booking where customer_name like $1",
      [`${PREFIX}%`],
    );
    const ids = (rows as { id: number }[]).map((row) => row.id);
    if (ids.length === 0) return;
    // Audit rows are append-only by database trigger, so they stay; the booking
    // row and its queued message are what a rerun must not inherit.
    await client.query(
      "delete from outbox_message where booking_id = any($1)",
      [ids],
    );
    await client.query("delete from payment_proof where booking_id = any($1)", [
      ids,
    ]);
    await client.query("delete from booking where id = any($1)", [ids]);
  });
}

interface BookingRow {
  id: number;
  status: string;
  source: string;
  price_egp: number;
  deposit_egp: number;
  remainder_paid: boolean;
  locale: string;
  customer_phone: string;
}

async function bookingRow(customerName: string): Promise<BookingRow | null> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `select id, status, source, price_egp, deposit_egp, remainder_paid,
              locale, customer_phone
         from booking where customer_name = $1`,
      [customerName],
    );
    return (rows[0] as BookingRow | undefined) ?? null;
  });
}

async function outboxTemplates(bookingId: number): Promise<string[]> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      "select template from outbox_message where booking_id = $1 order by id",
      [bookingId],
    );
    return (rows as { template: string }[]).map((row) => row.template);
  });
}

async function auditActions(bookingId: number): Promise<string[]> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      "select action from audit_log where booking_id = $1 order by id",
      [bookingId],
    );
    return (rows as { action: string }[]).map((row) => row.action);
  });
}

async function cancelReason(bookingId: number): Promise<string | null> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `select detail->>'reason' as reason from audit_log
        where booking_id = $1 and action = 'booking.cancel'`,
      [bookingId],
    );
    return (rows[0] as { reason: string | null } | undefined)?.reason ?? null;
  });
}

async function seedHeldBooking(code: string, customerName: string) {
  await withDb(async (client) => {
    const { rows } = await client.query(
      "select id, price_egp from occasion where active = true order by position, id limit 1",
    );
    const occasion = rows[0] as { id: number; price_egp: number } | undefined;
    if (!occasion) throw new Error("Seed the database: no active occasion.");

    const deposit = Math.round((occasion.price_egp * 50) / 100);
    await client.query(
      `insert into booking
         (public_id, access_token, occasion_id, starts_at, ends_at, status,
          source, customer_name, customer_phone, locale, price_egp, deposit_egp,
          hold_expires_at, urgent, remainder_paid)
       values ($1, $2, $3, $4, $5, 'held', 'online', $6, '+201009998877', 'en',
               $7, $8, now() + interval '12 minutes', false, false)`,
      [
        code,
        `e2e-token-${code}`,
        occasion.id,
        `${RACE_DAY} 10:00:00+02`,
        `${RACE_DAY} 14:00:00+02`,
        customerName,
        occasion.price_egp,
        deposit,
      ],
    );
  });
}

async function loginToBookings(page: Page) {
  await page.goto("/en/dashboard/bookings");
  await page.locator('input[name="username"]').fill(OWNER);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL(/\/en\/dashboard\/bookings$/);
  await expect(
    page.getByRole("heading", { name: "Bookings", level: 1 }),
  ).toBeVisible();
}

test.beforeEach(async () => {
  await purgeE2eBookings();
});

test.afterEach(async () => {
  await purgeE2eBookings();
});

test("staff enter a phone booking, mark it paid and cancel it", async ({
  page,
}) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const name = `${PREFIX} Mona ${suffix}`;
  const phone = `010${suffix.slice(-8).padStart(8, "0")}`;

  await loginToBookings(page);

  // ---- Add a booking for a caller -----------------------------------------
  await page.getByRole("button", { name: "Add booking" }).click();
  const addDialog = page.getByRole("dialog");
  await expect(addDialog).toBeVisible();

  await addDialog.getByLabel("Date").fill(ENTRY_DAY);
  const slot = addDialog.getByRole("button", {
    name: /10:00 AM.*2:00 PM.*Free/,
  });
  await expect(slot).toBeVisible();
  await slot.click();
  await addDialog.getByLabel("Occasion").selectOption({ index: 1 });
  await addDialog.getByLabel("Name").fill(name);
  await addDialog.getByLabel("Phone").fill(phone);
  await addDialog.getByLabel("Note (optional)").fill("E2E deposit in cash");

  const createResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/staff/bookings") &&
      response.request().method() === "POST",
  );
  await addDialog.getByRole("button", { name: "Add booking" }).click();
  expect((await createResponse).status()).toBe(201);

  const added = page.getByText(/^Booking [A-Z0-9]{6} added\.$/);
  await expect(added).toBeVisible();
  const code = (await added.textContent())!.match(/[A-Z0-9]{6}/)![0]!;
  expect(code).toHaveLength(6);

  // The booking starts confirmed, entered by staff, with the occasion's price
  // and no recorded deposit â€” its remainder is the whole price.
  await expect
    .poll(() => bookingRow(name))
    .toMatchObject({
      status: "confirmed",
      source: "staff",
      deposit_egp: 0,
      remainder_paid: false,
    });
  const created = (await bookingRow(name))!;
  expect(created.price_egp).toBeGreaterThan(0);
  expect(await outboxTemplates(created.id)).toContain("booking-confirmed");
  expect(await auditActions(created.id)).toContain("booking.enter");

  // The detail opens on the new booking, with the entered-by-staff marker.
  await expect(
    page.getByRole("heading", { name: "Wedding", level: 2 }),
  ).toBeVisible();
  const panel = page.locator("aside");
  await expect(panel.getByText("Entered by staff")).toBeVisible();
  await expect(panel.getByText("Unpaid")).toBeVisible();
  await expect(panel.getByText("E2E deposit in cash")).toBeVisible();

  // ---- Mark the remainder paid --------------------------------------------
  await page.getByRole("button", { name: "Mark remainder paid" }).click();
  await expect(
    page.getByRole("heading", { name: "Mark the remainder paid?" }),
  ).toBeVisible();
  const paidResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/bookings/${code}/remainder-paid`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Mark paid" }).click();
  expect((await paidResponse).status()).toBe(200);
  await expect(page.getByText("Remainder marked paid.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() => bookingRow(name))
    .toMatchObject({
      remainder_paid: true,
    });
  expect(
    (await auditActions(created.id)).filter(
      (a) => a === "booking.remainder_paid",
    ),
  ).toHaveLength(1);

  // ---- Cancel it, with a reason -------------------------------------------
  await page.getByRole("button", { name: "Cancel booking" }).click();
  const cancelDialog = page.getByRole("dialog");
  await expect(
    page.getByRole("heading", { name: "Cancel this booking?" }),
  ).toBeVisible();
  await cancelDialog.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Enter a reason.")).toBeVisible();

  const reason = "E2E family changed the date";
  await cancelDialog.getByLabel("Reason").fill(reason);
  const cancelResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/bookings/${code}/cancel`) &&
      response.request().method() === "POST",
  );
  await cancelDialog.getByRole("button", { name: "Cancel booking" }).click();
  expect((await cancelResponse).status()).toBe(200);
  await expect(page.getByText("Booking cancelled.")).toBeVisible();
  await expect
    .poll(() => bookingRow(name))
    .toMatchObject({
      status: "cancelled",
    });
  expect(await cancelReason(created.id)).toBe(reason);

  // The history shows the cancellation at once.
  await expect(page.getByText("Booking cancelled").last()).toBeVisible();

  // ---- The list filters and search find it, and the URL keeps them ---------
  await page.getByRole("searchbox").fill(name);
  await page.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(
    page.getByRole("button", { name: `Open booking ${code}` }).first(),
  ).toBeVisible();

  await page.getByLabel("Status").selectOption("cancelled");
  await expect(page).toHaveURL(/status=cancelled/);
  await expect(
    page.getByRole("button", { name: `Open booking ${code}` }).first(),
  ).toBeVisible();

  // ---- Below md it is cards and a full-page detail ------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("table")).toBeHidden();
  await page
    .getByRole("button", { name: `Open booking ${code}` })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Wedding", level: 2 }),
  ).toBeVisible();
  await expect(
    page.locator("aside").getByText("Cancelled", { exact: true }),
  ).toBeVisible();
});

test("a slot held online is refused with the holder and the form is kept", async ({
  page,
}) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const name = `${PREFIX} Staff ${suffix}`;
  const phone = `011${suffix.slice(-8).padStart(8, "0")}`;
  const holderName = `${PREFIX} Holder ${suffix}`;
  const holderCode = `H${suffix.slice(-5)}`;

  await loginToBookings(page);

  await page.getByRole("button", { name: "Add booking" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Date").fill(RACE_DAY);

  // The slot is free when the dialog reads it, and a hold takes it before the
  // save: the server decides the race, so the answer must be SLOT_TAKEN with
  // the holder's name and deadline, and the dialog must keep the form.
  const slot = dialog.getByRole("button", {
    name: /10:00 AM.*2:00 PM.*Free/,
  });
  await expect(slot).toBeVisible();
  await slot.click();
  await dialog.getByLabel("Occasion").selectOption({ index: 1 });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Phone").fill(phone);

  await seedHeldBooking(holderCode, holderName);

  const raceResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/staff/bookings") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Add booking" }).click();
  expect((await raceResponse).status()).toBe(409);

  await expect(
    page.getByText("This slot already has a booking."),
  ).toBeVisible();
  await expect(
    page.getByText(new RegExp(`${holderName} holds this slot until`)),
  ).toBeVisible();
  await expect(dialog.getByLabel("Name")).toHaveValue(name);
  await expect(dialog.getByLabel("Phone")).toHaveValue(phone);

  // Nothing was written for the staff entry.
  expect(await bookingRow(name)).toBeNull();

  await page.keyboard.press("Escape");
});
