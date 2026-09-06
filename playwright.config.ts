import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch:
    process.env.LOCAL_STAGING_E2E === "true"
      ? "local-staging.spec.ts"
      : "workflow.spec.ts",
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
          command:
            process.env.LOCAL_STAGING_E2E === "true"
              ? "pnpm dev:staging"
              : "pnpm dev",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: false,
          env: { DEMO_MODE: "true", LOCAL_STAGING_MODE: "false" },
          timeout: 120000,
        },
      }
    : {}),
});
