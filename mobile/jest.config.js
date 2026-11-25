/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/App.test.tsx", "<rootDir>/src/**/*.test.{ts,tsx}"],
  collectCoverageFrom: [
    "App.tsx",
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
  ],
  coverageReporters: ["text-summary", "lcov"],
  coverageDirectory: "coverage",
  // Same gate as the web suite (docs/architecture/testing.md).
  coverageThreshold: {
    global: { lines: 80, statements: 80, branches: 70 },
  },
  clearMocks: true,
};
