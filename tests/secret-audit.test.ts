import { afterEach, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

let folder: string;
const privateValue = "noncredential-audit-test-marker-123456789";
const publicValue = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.test-signature`;
afterEach(async () => {
  if (folder) await rm(folder, { recursive: true, force: true });
});
async function setup(publicKey = publicValue) {
  folder = await mkdtemp(path.join(tmpdir(), "reviewangle-audit-"));
  spawnSync("git", ["init", "--quiet"], { cwd: folder });
  await writeFile(
    path.join(folder, ".env.local"),
    `OPENAI_API_KEY=${privateValue}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${publicKey}\n`,
  );
}
function audit() {
  return spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../scripts/check-secrets.mjs", import.meta.url))],
    { cwd: folder, encoding: "utf8" },
  );
}
it("permits the intentional public anon key in a browser artifact", async () => {
  await setup();
  await writeFile(path.join(folder, "browser.js"), publicValue);
  const result = audit();
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).secretMatches).toBe(0);
});
it("finds private values without printing them", async () => {
  await setup();
  await writeFile(path.join(folder, "leaked-cache.bin"), privateValue);
  const result = audit();
  expect(result.status).toBe(1);
  expect(result.stdout.includes(privateValue)).toBe(false);
  expect(JSON.parse(result.stdout).secretMatches).toBe(1);
});
it("does not exempt a server-role key mistakenly placed in the public key variable", async () => {
  const serverKey = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.test-signature`;
  await setup(serverKey);
  await writeFile(path.join(folder, "browser.js"), serverKey);
  const result = audit();
  expect(result.status).toBe(1);
  expect(result.stdout.includes(serverKey)).toBe(false);
});
