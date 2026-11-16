// SPEC: docs/features/venue-settings/spec.md — only the owner changes occasions, prices and booking rules; deposit is 1–100
// ROADMAP: phase-2-foundations / venue-settings / settings screen (axiom:ui-check distillation)
// Needs the dev seed (`npm run db:seed`): owner login with SEED_OWNER_PASSWORD or the default.
// These tests never save a change: every action is cancelled or rejected.
import { expect, test, type Page } from "@playwright/test";

const OWNER = "owner";
const PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "owner-password";

async function loginToSettings(page: Page, locale: "ar" | "en") {
  const prefix = locale === "en" ? "/en" : "";
  await page.goto(`${prefix}/dashboard/settings`);
  // The login page is Arabic or English following the requested locale.
  await page
    .locator('input[type="text"], input:not([type])')
    .first()
    .fill(OWNER);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator("main ul li").first()).toBeVisible();
}

for (const locale of ["ar", "en"] as const) {
  test.describe(`venue settings (${locale})`, () => {
    test("deactivating an occasion asks first; cancelling changes nothing", async ({
      page,
    }) => {
      // VIEW: venue-settings/design.md § Interactions — deactivation asks for confirmation
      await loginToSettings(page, locale);
      const requests: string[] = [];
      page.on("request", (r) => {
        if (r.method() === "PATCH") requests.push(r.url());
      });
      let asked = "";
      page.once("dialog", async (dialog) => {
        asked = dialog.message();
        await dialog.dismiss();
      });
      const rows = page.locator("main ul li");
      const before = await rows.first().innerText();
      await rows.first().locator('button[type="button"]').click();
      await expect.poll(() => asked).not.toBe("");
      expect(requests).toEqual([]);
      expect(await rows.first().innerText()).toBe(before);
    });

    test("a deposit above 100 is rejected with the localized notice", async ({
      page,
    }) => {
      // SPEC: venue-settings — the deposit percentage is between 1 and 100
      // VIEW: venue-settings/design.md § States — validation is localized, not the browser's text
      await loginToSettings(page, locale);
      await page.locator('input[name="depositPercent"]').fill("150");
      const response = page.waitForResponse(
        (r) =>
          r.url().includes("/staff/settings") && r.request().method() === "PUT",
      );
      await page
        .locator('form:has(input[name="depositPercent"]) button[type=submit]')
        .click();
      expect((await response).status()).toBe(422);
      const notice = page.locator('p[role="alert"]');
      await expect(notice).toBeVisible();
      // The localized notice mentions the 1–100 range in the page language.
      await expect(notice).toHaveText(
        locale === "ar" ? /العربون/ : /deposit is between 1 and 100/,
      );
    });
  });
}

test("settings content does not overflow horizontally at 360px", async ({
  page,
}) => {
  // VIEW: docs/design/system.md — layouts hold at phone width
  await page.setViewportSize({ width: 360, height: 740 });
  await loginToSettings(page, "ar");
  const overflowing = await page.evaluate(
    () =>
      [...document.querySelectorAll("main *")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
      }).length,
  );
  expect(overflowing).toBe(0);
});
