import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { context, type Context } from "../src/lib/server/context";
import { localStagingAllowed } from "../src/lib/server/local-staging";
import { createProject, step } from "../src/lib/server/service";
import { getProject, listProjects, locked } from "../src/lib/server/store";

const mock = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse: mock.parse };
  },
}));
let folder: string;
beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("LOCAL_STAGING_MODE", "true");
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  folder = await mkdtemp(path.join(tmpdir(), "reviewangle-test-"));
  vi.spyOn(process, "cwd").mockReturnValue(folder);
  mock.parse.mockReset();
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(folder, { recursive: true, force: true });
});
function request(host = "127.0.0.1:3000", extra: Record<string, string> = {}) {
  return new NextRequest(`http://${host}/api/projects`, {
    method: "POST",
    headers: { host, origin: `http://${host}`, ...extra },
  });
}
it.each(["localhost:3000", "127.0.0.1:3000"])(
  "allows direct local staging at %s without Supabase",
  async (host) => {
    expect(await context(request(host))).toMatchObject({
      demo: false,
      localStaging: true,
    });
  },
);
it.each([
  ["example.com", {}],
  ["192.168.1.2:3000", {}],
  ["localhost.evil.test", {}],
  ["127.1:3000", {}],
  ["[::1]:3000", {}],
  ["127.0.0.1:3000", { origin: "https://evil.test" }],
  ["127.0.0.1:3000", { origin: "http://localhost:3000" }],
  ["127.0.0.1:3000", { origin: "null" }],
  ["127.0.0.1:3000", { "x-forwarded-host": "evil.test" }],
  ["127.0.0.1:3000", { "x-forwarded-for": "203.0.113.1" }],
  ["127.0.0.1:3000", { forwarded: "host=localhost" }],
  ["127.0.0.1:3000", { "sec-fetch-site": "cross-site" }],
  ["127.0.0.1:3000", { "x-forwarded-proto": "https" }],
] as [string, Record<string, string>][])(
  "rejects unsafe host/origin/proxy %s %j",
  async (host, extra) => {
    await expect(context(request(host, extra))).rejects.toMatchObject({
      status: 403,
    });
  },
);
it("requires Host and request URL to match, including GETs", async () => {
  await expect(
    context(
      new NextRequest("http://127.0.0.1:3000/api/projects", {
        headers: { host: "localhost:3001" },
      }),
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(localStagingAllowed(new Headers())).toBe(false);
});
it("refuses production, conflicting demo, and missing OpenAI configuration", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(context(request())).rejects.toMatchObject({ status: 503 });
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DEMO_MODE", "true");
  await expect(context(request())).rejects.toMatchObject({ status: 503 });
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("OPENAI_API_KEY", "");
  await expect(context(request())).rejects.toMatchObject({ status: 503 });
});
it("does not bypass configuration when the staging flag is off", async () => {
  vi.stubEnv("LOCAL_STAGING_MODE", "false");
  await expect(context(request())).rejects.toMatchObject({ status: 503 });
});
it("persists arbitrary reviews separately and calls the real provider SDK boundary", async () => {
  const c = await context(request());
  const p = await createProject(c, {
    name: "Arbitrary local reviews",
    language: "en",
    reviews: [
      {
        text: "The ceramic mug keeps my morning tea warm through the commute.",
      },
    ],
  });
  expect(p.demo).toBe(false);
  mock.parse.mockResolvedValue({
    output_parsed: {
      records: [
        {
          reviewId: p.reviews[0].id,
          sentiment: "positive",
          facts: [
            {
              category: "benefit",
              label: "Warm tea",
              quote: "keeps my morning tea warm",
              scope: "product",
            },
          ],
        },
      ],
    },
  });
  const next = await step(c, p.id);
  expect(mock.parse).toHaveBeenCalledOnce();
  expect(mock.parse.mock.calls[0][0].store).toBe(false);
  expect(next.run.stage).toBe("themes");
  expect((await getProject(c, p.id)).extractions).toHaveLength(1);
  expect(
    JSON.parse(
      await readFile(
        path.join(folder, ".local/staging", `${p.id}.json`),
        "utf8",
      ),
    ).id,
  ).toBe(p.id);
  const demo: Context = { userId: "demo", demo: true };
  expect(await listProjects(demo)).toEqual([]);
  await expect(getProject(demo, p.id)).rejects.toMatchObject({ status: 404 });
  await expect(
    createProject(demo, {
      name: "Demo",
      language: "en",
      reviews: [
        {
          text: "A completely arbitrary review cannot use the fixture provider.",
        },
      ],
    }),
  ).rejects.toThrow("fixtures only");
  await expect(getProject(c, "../../.env.local")).rejects.toMatchObject({
    status: 404,
  });
  await locked(c, p.id, async () => {
    await expect(locked(c, p.id, async () => {})).rejects.toMatchObject({
      status: 409,
    });
  });
});
