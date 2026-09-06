import { spawn } from "node:child_process";
import { createRequire } from "node:module";

if (process.env.NODE_ENV === "production") {
  console.error("Local staging cannot run in production.");
  process.exit(1);
}
const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1"],
  {
    stdio: "inherit",
    env: { ...process.env, LOCAL_STAGING_MODE: "true", DEMO_MODE: "false" },
  },
);
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
