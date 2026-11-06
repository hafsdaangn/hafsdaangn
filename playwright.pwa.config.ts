import { defineConfig } from "@playwright/test";

// The fixture document and assets are fulfilled by Playwright. No application
// server or authenticated backend is needed to test real onboarding components.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "pwa-onboarding.spec.ts",
    "post-notifications.spec.ts",
    "select.spec.ts",
  ],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3299",
    headless: true,
    trace: "retain-on-failure",
  },
  reporter: "list",
});
