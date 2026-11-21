// SPEC: booking-reports/spec.md — the owner picks a period and reads bookings and income by occasion and month, then exports the figures
// ROADMAP: phase-6-alerts-and-reports / booking-reports / Implement reports view with period filter and export
// Needs the local database (`npm run db:up`) and the dev seed. The test adds a
// uniquely named occasion and one confirmed booking in the current Cairo month,
// then removes them; it never touches existing rows.
import { expect, test, type BrowserContext } from "@playwright/test";
import { Client } from "pg";

const OWNER = "owner";
const PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "owner-password";
const NAME_AR = "تقرير اختبار";
const NAME_EN = "E2E Report Occasion";

let cookies: Awaited<ReturnType<BrowserContext["storageState"]>>["cookies"] =
  [];
let client: Client;
let occasionId = 0;
let publicId = "";

test.beforeAll(async ({ browser }) => {
  client = new Client({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://wesal:wesal@localhost:5432/wesal",
  });
  await client.connect();

  publicId = `RP${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const occasion = await client.query(
    "insert into occasion (name_ar, name_en, price_egp, position) values ($1, $2, 15000, 99) returning id",
    [NAME_AR, NAME_EN],
  );
  occasionId = occasion.rows[0].id as number;
  await client.query(
    `insert into booking
       (public_id, access_token, occasion_id, starts_at, ends_at, status, source,
        customer_name, customer_phone, locale, price_egp, deposit_egp, remainder_paid, hold_expires_at)
     values ($1, $2, $3, now(), now() + interval '2 hours', 'confirmed', 'online',
        'E2E Reports', '+201000009999', 'ar', 15000, 7500, false, null)`,
    [publicId, `token-${publicId}`, occasionId],
  );

  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
  });
  const page = await context.newPage();
  await page.goto("/dashboard/login");
  await page
    .locator('input[type="text"], input:not([type])')
    .first()
    .fill(OWNER);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  cookies = (await context.storageState()).cookies;
  await context.close();
});

test.afterAll(async () => {
  await client.query("delete from booking where public_id = $1", [publicId]);
  await client.query("delete from occasion where id = $1", [occasionId]);
  await client.end();
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(cookies);
});

for (const locale of ["ar", "en"] as const) {
  test.describe(`reports (${locale})`, () => {
    const prefix = locale === "en" ? "/en" : "";

    test("shows the period's figures and exports the same month", async ({
      page,
    }) => {
      // VIEW: reports.md § Default — the current month is preselected
      await page.goto(`${prefix}/dashboard/reports`);
      await expect(page.locator("main h1")).toHaveText(
        locale === "ar" ? "التقارير" : "Reports",
      );

      const body = page.locator("main");
      await expect(
        body
          .getByText(locale === "ar" ? NAME_AR : NAME_EN, { exact: true })
          .first(),
      ).toBeVisible();
      await expect(
        body.getByText(
          locale === "ar" ? "الحجوزات حسب المناسبة" : "Bookings by occasion",
          { exact: true },
        ),
      ).toHaveCount(2); // heading and table caption

      // VIEW: reports.md § Interactions — Export downloads the period's figures
      const download = page.waitForEvent("download");
      await page
        .getByRole("link", { name: locale === "ar" ? /تصدير/ : /Export/ })
        .click();
      const file = await download;
      const stream = await file.createReadStream();
      let csv = "";
      for await (const chunk of stream) csv += chunk.toString("utf8");
      expect(csv).toContain("Confirmed bookings");
      expect(csv).toContain(NAME_EN);
      expect(file.suggestedFilename()).toMatch(
        /^wesal-report-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/,
      );
    });
  });
}

test("reports hold at phone width without horizontal overflow", async ({
  page,
}) => {
  // VIEW: reports.md § Responsive behavior — charts full width, tables scroll
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/dashboard/reports");
  await expect(page.locator("main h1")).toBeVisible();
  const overflowing = await page.evaluate(
    () =>
      [...document.querySelectorAll("main *")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
      }).length,
  );
  expect(overflowing).toBe(0);
});
