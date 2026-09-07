import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const local = parseEnv(readFileSync(".env.local", "utf8"));
for (const [name, value] of Object.entries(local)) process.env[name] ??= value;
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
]) {
  if (!process.env[name])
    throw new Error(
      `Supabase integration blocked: missing ${name} in ignored local environment.`,
    );
}
if (
  process.env.NEXT_PUBLIC_SUPABASE_URL !==
  "https://hdtkzoksuxdmabxfxeyu.supabase.co"
)
  throw new Error(
    "Supabase integration is restricted to the existing staging project.",
  );
export default defineConfig({
  testDir: "./e2e",
  testMatch: "supabase.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 600_000,
  reporter: "list",
  // Auth tokens must not enter traces, screenshots, videos or HTML reports.
  use: {
    baseURL: "http://127.0.0.1:3000",
    channel: "chrome",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    env: { DEMO_MODE: "false", LOCAL_STAGING_MODE: "false" },
    timeout: 120_000,
  },
});
