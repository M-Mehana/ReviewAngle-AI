import { readFile, readdir } from "node:fs/promises";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";
import { inflateRawSync } from "node:zlib";
import path from "node:path";

// Compare in memory; never print secret values, matching lines, or file contents.
const env = parseEnv(await readFile(".env.local", "utf8"));
const secrets = Object.entries(env)
  .filter(
    ([name, value]) =>
      /KEY|TOKEN|SECRET|PASSWORD/.test(name) && value.length >= 16,
  )
  .map(([, value]) => Buffer.from(value));
if (!secrets.length)
  throw new Error("No local credentials available for the secret audit.");
const findings = new Set();
let checked = 0;
function inspect(name, data) {
  checked++;
  if (secrets.some((secret) => data.includes(secret))) findings.add(name);
}
function inspectZip(name, data) {
  let end = data.length - 22;
  while (
    end >= Math.max(0, data.length - 65557) &&
    data.readUInt32LE(end) !== 0x06054b50
  )
    end--;
  if (end < 0) throw new Error("Could not inspect ZIP artifact.");
  const entries = data.readUInt16LE(end + 10);
  let cursor = data.readUInt32LE(end + 16);
  for (let i = 0; i < entries; i++) {
    if (data.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error("Invalid ZIP directory.");
    const method = data.readUInt16LE(cursor + 10);
    const size = data.readUInt32LE(cursor + 20);
    const nameLength = data.readUInt16LE(cursor + 28);
    const extraLength = data.readUInt16LE(cursor + 30);
    const commentLength = data.readUInt16LE(cursor + 32);
    const offset = data.readUInt32LE(cursor + 42);
    const entry = data
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString();
    const start =
      offset +
      30 +
      data.readUInt16LE(offset + 26) +
      data.readUInt16LE(offset + 28);
    const compressed = data.subarray(start, start + size);
    if (![0, 8].includes(method))
      throw new Error("Unsupported ZIP compression in artifact audit.");
    inspect(
      `${name}:${entry}`,
      method === 8 ? inflateRawSync(compressed) : compressed,
    );
    cursor += 46 + nameLength + extraLength + commentLength;
  }
}
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) await walk(file);
    else {
      if (path.resolve(file) === path.resolve(".env.local")) continue;
      const data = await readFile(file);
      inspect(file, data);
      if (file.endsWith(".zip")) inspectZip(file, data);
    }
  }
}
await walk(".");
inspect("git working diff", execFileSync("git", ["diff", "--no-ext-diff"]));
inspect(
  "git staged diff",
  execFileSync("git", ["diff", "--cached", "--no-ext-diff"]),
);
console.log(
  JSON.stringify({
    checked,
    secretMatches: findings.size,
    files: [...findings],
  }),
);
if (findings.size) process.exitCode = 1;
