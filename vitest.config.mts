import { defineConfig } from "vitest/config";

// Two projects (docs/architecture/testing.md): `unit` is pure and fast;
// `integration` (*.int.test.ts) runs against the real docker-compose Postgres.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/**/*.d.ts",
        "src/components/ui/**", // shadcn/ui source copied into the repo
        "src/db/schema/**", // declarative table definitions
        "src/i18n/catalog-parity.ts", // compile-time check, no runtime code
        "src/app/**", // pages and layouts: covered by Playwright
        "src/proxy.ts", // framework entry points: covered by Playwright
        "src/i18n/request.ts",
        "src/i18n/navigation.ts",
        "src/components/theme-toggle.tsx",
        "src/auth/create-owner.ts", // CLI entry; the logic is tested through first-owner.ts
        "src/db/migrate.ts", // CLI entry; runMigrations is exercised by setup.int.test.ts
      ],
      thresholds: { lines: 80, statements: 80, branches: 70 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.int.test.{ts,tsx}"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.int.test.{ts,tsx}"],
          environment: "node",
          globalSetup: ["src/test/global-setup.ts"],
          // One shared database: files run one after another.
          fileParallelism: false,
          testTimeout: 15_000,
        },
      },
    ],
  },
});
