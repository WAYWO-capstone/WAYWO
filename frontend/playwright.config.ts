// Playwright configuration for E2E tests

import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const externalBaseUrl = process.env.BASE_URL;
const BASE_URL = externalBaseUrl ?? `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",

  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "html",

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],

  webServer: externalBaseUrl
    ? undefined
    : [
        {
          // Backend. /database-test only returns 200 once Postgres is reachable,
          // so the run waits on a working DB, not just a booted process.
          command: "uvicorn app.main:app --port 8000",
          cwd: "../backend",
          url: "http://localhost:8000/database-test",
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
        {
          command: "bun run dev --port 5173 --strictPort",
          url: BASE_URL,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
      ],
});