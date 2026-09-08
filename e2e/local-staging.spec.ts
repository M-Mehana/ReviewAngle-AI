import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { Project } from "../src/lib/analysis/schema";

// Explicit opt-in: these tests make paid OpenAI requests through the real app.
test.skip(
  process.env.LOCAL_STAGING_E2E !== "true",
  "Requires explicit live staging opt-in",
);
const reviews = [
  "The ceramic travel mug keeps my tea warm during my long morning commute. The lid has not leaked in my work bag.",
  "I take this mug to the office every day because my coffee stays warm. Cleaning under the lid takes too much time.",
  "The handle feels comfortable when I carry the mug from the station. It is too wide for the cup holder in my car.",
];

function verifyEvidence(p: Project) {
  const reviews = new Map(p.reviews.map((r) => [r.id, r]));
  const themes = new Map(p.themes.map((t) => [t.id, t]));
  expect(p.demo).toBe(false);
  expect(p.run.model).not.toContain("synthetic");
  expect(p.run.failedReviewIds).toEqual([]);
  expect(p.extractions).toHaveLength(p.reviews.length);
  for (const e of p.extractions) {
    expect(reviews.has(e.reviewId)).toBe(true);
    for (const fact of e.facts)
      expect(reviews.get(e.reviewId)!.masked).toContain(fact.quote);
  }
  expect(p.themes.length).toBeGreaterThan(0);
  expect(p.insights.length).toBeGreaterThan(0);
  expect(p.angles.length).toBeGreaterThan(0);
  for (const theme of p.themes) {
    expect(theme.count).toBe(new Set(theme.reviewIds).size);
    for (const id of theme.reviewIds) expect(reviews.has(id)).toBe(true);
    for (const quote of theme.quotes)
      expect(reviews.get(quote.reviewId)!.masked).toContain(quote.quote);
  }
  for (const item of [...p.insights, ...p.angles]) {
    expect(item.themeIds.length).toBeGreaterThan(0);
    for (const id of item.themeIds) expect(themes.has(id)).toBe(true);
    const expected = [
      ...new Set(item.themeIds.flatMap((id) => themes.get(id)!.reviewIds)),
    ].sort();
    expect([...item.reviewIds].sort()).toEqual(expected);
    for (const id of item.reviewIds) expect(reviews.has(id)).toBe(true);
  }
}

for (const language of ["ar", "ar-EG"] as const) {
  test(`real OpenAI ${language}: arbitrary import, analysis, evidence and persistence`, async ({
    page,
    request,
  }) => {
    test.setTimeout(600_000);
    const consoleErrors: string[] = [];
    page.on("pageerror", () => consoleErrors.push("browser error"));
    await page.addInitScript(() =>
      localStorage.setItem("reviewangle-ui", "en"),
    );
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText(
      "Local staging — real OpenAI, local data",
    );
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Project name").fill(`Phase 2 live ${language}`);
    await page.getByLabel("Marketing output language").selectOption(language);
    if (language === "ar") {
      await page
        .getByLabel("One review per paragraph")
        .fill(reviews.join("\n\n"));
    } else {
      await page.getByRole("tab", { name: "Upload file" }).click();
      await page.locator("input[type=file]").setInputFiles({
        name: "staging-reviews.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "text,rating\n" + reviews.map((r) => `"${r}",4`).join("\n"),
        ),
      });
    }
    await page
      .getByRole("button", { name: "Preview reviews", exact: true })
      .click();
    await expect(page.getByText("3 ready to analyze")).toBeVisible();
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/projects") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Analyze reviews", exact: true })
      .click();
    const initial = await (await created).json();
    expect(initial.project?.id).toBeTruthy();
    let project: Project = initial.project;
    await expect
      .poll(
        async () => {
          const result = await request.get(
            `/api/projects/${initial.project.id}`,
          );
          project = (await result.json()).project;
          return ["complete", "failed"].includes(project.run.stage);
        },
        { timeout: 540_000, intervals: [1000, 3000, 5000] },
      )
      .toBe(true);
    expect(
      project.run.stage,
      project.run.error || "Live analysis must complete",
    ).toBe("complete");
    verifyEvidence(project);
    const copy = project.angles.map((a) => `${a.hook} ${a.copy}`).join(" ");
    if (language === "ar") expect(copy).toMatch(/[\u0600-\u06ff]/);
    else {
      expect(copy).toMatch(/[\u0600-\u06ff]/);
      expect(copy).toMatch(/مش|عشان|بت|خليك|دلوقتي|من غير|معاك|ليك|يخليك/);
    }
    await page.getByRole("button", { name: "Ad Angles", exact: true }).click();
    await page
      .getByRole("button", { name: /supporting reviews/ })
      .first()
      .click();
    await expect(
      page.getByRole("dialog").locator("code").first(),
    ).toContainText(/^[a-f0-9-]{36}$/);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page.reload();
    await page.getByRole("button", { name: /All projects/ }).click();
    await expect(
      page
        .getByRole("button", { name: new RegExp(`Phase 2 live ${language}`) })
        .first(),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
    await mkdir(".local/validation", { recursive: true });
    await writeFile(
      `.local/validation/${language}.json`,
      JSON.stringify(
        {
          language,
          projectId: project.id,
          model: project.run.model,
          reviews: project.reviews.length,
          themes: project.themes.length,
          angles: project.angles.length,
          evidenceVerified: true,
          sampleHook: project.angles[0].hook,
          sampleCopy: project.angles[0].copy,
        },
        null,
        2,
      ),
    );
  });
}

test("local staging accepts arbitrary TXT and rejects hostile request origins", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => localStorage.setItem("reviewangle-ui", "en"));
  await page.goto("/");
  await page.getByRole("tab", { name: "Upload file" }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "staging.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(reviews.join("\n\n")),
  });
  await page
    .getByRole("button", { name: "Preview reviews", exact: true })
    .click();
  await expect(page.getByText("3 ready to analyze")).toBeVisible();
  // Stop before paid analysis, but exercise the real import/persistence endpoint.
  const created = await request.post("/api/projects", {
    data: {
      name: "Phase 2 TXT persistence",
      language: "ar",
      reviews: reviews.map((text) => ({ text, source: "staging.txt" })),
    },
  });
  expect(created.ok()).toBe(true);
  const p = (await created.json()).project;
  expect(p.demo).toBe(false);
  expect(
    (await (await request.get(`/api/projects/${p.id}`)).json()).project.reviews,
  ).toHaveLength(3);
  const hostileHeaders: Record<string, string>[] = [
    { origin: "https://evil.test" },
    { "x-forwarded-host": "evil.test" },
    { host: "evil.test" },
    { "x-forwarded-for": "203.0.113.1" },
  ];
  for (const headers of hostileHeaders) {
    expect((await request.get("/api/projects", { headers })).status()).toBe(
      403,
    );
  }
});
