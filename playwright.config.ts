import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (ADR-019). Smoke only for now; the booking and staff
// journeys arrive with their sections. CI retries once and reports flakes.
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build: what ships is what is tested. The journey needs a
    // deliverable verification code without a real provider, so it logs instead.
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      MESSAGING_PROVIDER: "log",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
    },
  },
});
