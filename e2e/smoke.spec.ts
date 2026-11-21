// SPEC: docs/features/landing-page/spec.md — Arabic is the default (RTL); English is served under /en
// ROADMAP: phase-1-infrastructure / testing / Install Playwright; write smoke test loading the home page in Arabic and English
import { expect, test } from "@playwright/test";

test("home page loads in Arabic, right-to-left, at /", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("home page loads in English, left-to-right, at /en", async ({ page }) => {
  const response = await page.goto("/en");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Wesal Mosque and Event Hall",
  );
});
