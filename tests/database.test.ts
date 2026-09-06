import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { prepareReviews } from "../src/lib/ingestion";
import type { Project } from "../src/lib/analysis/schema";
it("applies migration, persists relational evidence, enforces ownership and atomically reserves quota", async () => {
  const db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609060001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const owner = crypto.randomUUID(),
    other = crypto.randomUUID();
  await db.query("insert into auth.users values ($1),($2)", [owner, other]);
  const now = new Date().toISOString();
  const p: Project = {
    id: crypto.randomUUID(),
    name: "DB test",
    language: "en",
    demo: false,
    createdAt: now,
    updatedAt: now,
    reviews: prepareReviews([{ text: "A bottle that stays warm." }]).reviews,
    extractions: [],
    themes: [],
    insights: [],
    angles: [],
    followups: [],
    run: {
      id: crypto.randomUUID(),
      stage: "ready",
      processed: 0,
      failedReviewIds: [],
      model: "test",
      scoreVersion: "v1",
    },
  };
  await db.query("select save_project_snapshot($1,$2::jsonb)", [
    owner,
    JSON.stringify(p),
  ]);
  expect((await db.query("select * from reviews")).rows).toHaveLength(1);
  p.angles = [
    {
      id: crypto.randomUUID(),
      name: "Warm coffee",
      type: "benefit",
      persona: "Daily user",
      insight: "Warmth",
      themeIds: [],
      reviewIds: [p.reviews[0].id],
      score: 40,
      scoreBreakdown: { frequency: 1 },
      strength: "limited",
      saved: true,
      hook: "Warm coffee",
      alternativeHooks: [],
      copy: "Coffee for the commute",
      ugc: "A concept",
      firstThreeSeconds: "Bottle close-up",
      cta: "Explore",
    },
  ];
  p.followups = [
    {
      id: crypto.randomUUID(),
      angleId: p.angles[0].id,
      kind: "hooks",
      content: "A grounded hook",
      reviewIds: [p.reviews[0].id],
      createdAt: now,
    },
  ];
  await db.query("select save_project_snapshot($1,$2::jsonb)", [
    owner,
    JSON.stringify(p),
  ]);
  expect((await db.query("select * from angle_evidence")).rows).toHaveLength(1);
  expect((await db.query("select * from followups")).rows).toHaveLength(1);
  // Repeat snapshot writes preserve the same review identity and derived evidence.
  await db.query("select save_project_snapshot($1,$2::jsonb)", [
    owner,
    JSON.stringify(p),
  ]);
  expect((await db.query("select * from reviews")).rows).toHaveLength(1);
  const invalid = structuredClone(p);
  invalid.angles[0].reviewIds = [crypto.randomUUID()];
  await expect(
    db.query("select save_project_snapshot($1,$2::jsonb)", [
      owner,
      JSON.stringify(invalid),
    ]),
  ).rejects.toThrow("foreign key");
  expect((await db.query("select * from angle_evidence")).rows).toHaveLength(1);
  for (let i = 0; i < 120; i++)
    expect(
      (
        await db.query<{ reserve_request: boolean }>(
          "select reserve_request($1)",
          [owner],
        )
      ).rows[0].reserve_request,
    ).toBe(true);
  expect(
    (
      await db.query<{ reserve_request: boolean }>(
        "select reserve_request($1)",
        [owner],
      )
    ).rows[0].reserve_request,
  ).toBe(false);
  await expect(
    db.query("select save_project_snapshot($1,$2::jsonb)", [
      other,
      JSON.stringify(p),
    ]),
  ).rejects.toThrow("Owner mismatch");
  const quota = async (key: string, units: number) =>
    (
      await db.query<{ reserve_usage: boolean }>(
        "select reserve_usage($1,$2,$3,$4,$5)",
        [owner, key, "reviews", units, 10],
      )
    ).rows[0].reserve_usage;
  expect(await quota("one", 7)).toBe(true);
  expect(await quota("one", 7)).toBe(true);
  expect(await quota("two", 4)).toBe(false);
  expect(await quota("three", 3)).toBe(true);
  const lease = crypto.randomUUID();
  expect(
    (
      await db.query<{ claim_project: boolean }>(
        "select claim_project($1,$2,$3)",
        [owner, p.id, lease],
      )
    ).rows[0].claim_project,
  ).toBe(true);
  expect(
    (
      await db.query<{ claim_project: boolean }>(
        "select claim_project($1,$2,$3)",
        [owner, p.id, crypto.randomUUID()],
      )
    ).rows[0].claim_project,
  ).toBe(false);
  await db.query("select release_project($1,$2,$3)", [owner, p.id, lease]);
  await db.exec(
    `set role authenticated; set request.jwt.claim.sub = '${other}';`,
  );
  expect((await db.query("select * from projects")).rows).toHaveLength(0);
  await expect(
    db.query("select save_project_snapshot($1,$2::jsonb)", [
      other,
      JSON.stringify(p),
    ]),
  ).rejects.toThrow("permission denied");
  await db.exec(`set request.jwt.claim.sub = '${owner}';`);
  expect((await db.query("select * from projects")).rows).toHaveLength(1);
  await db.close();
});
