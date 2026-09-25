import { defineConfig } from "@playwright/test";
const modes = ["production", "development"] as const;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { channel: "msedge", headless: true, trace: "retain-on-failure" },
  projects: modes.map((name, i) => ({
    name,
    use: { baseURL: "http://127.0.0.1:" + (3100 + i) },
  })),
  webServer: modes.map((mode, i) => ({
    command: "npm run start -- --hostname 127.0.0.1 --port " + (3100 + i),
    url: "http://127.0.0.1:" + (3100 + i),
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      APP_ENV: mode,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
    },
  })),
  reporter: "list",
});
