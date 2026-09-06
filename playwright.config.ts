import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...(process.env.PLAYWRIGHT_CHROMIUM === "true"
      ? {}
      : { channel: "chrome" }),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: "list",
  ...(process.env.PLAYWRIGHT_START_SERVER === "true"
    ? {
        webServer: {
          command: "pnpm dev",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: false,
          env: { DEMO_MODE: "true" },
          timeout: 120000,
        },
      }
    : {}),
});
