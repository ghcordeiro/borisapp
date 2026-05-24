import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3001",
    url: "http://localhost:3001/login",
    reuseExistingServer: false,
    env: {
      E2E_AUTH_ENABLED: "true",
      NEXT_PUBLIC_E2E_AUTH_ENABLED: "true",
      AUTH_URL: "http://localhost:3001",
      NEXTAUTH_URL: "http://localhost:3001",
    },
  },
});
