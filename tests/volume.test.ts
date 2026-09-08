import { expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { performanceReviews } from "../scripts/prepare-validation-data.mjs";
import { prepareReviews, parseCSV, mapColumns } from "../src/lib/ingestion";
import { advance } from "../src/lib/analysis/pipeline";
import { factCatalog } from "../src/lib/analysis/aggregate";
import type { Project } from "../src/lib/analysis/schema";
import type { ModelProvider } from "../src/lib/analysis/provider";

it.each([50, 200])(
  "processes %i non-customer reviews through bounded pipeline stages",
  async (count) => {
    const started = performance.now();
    const raw = performanceReviews(count);
    const csv =
      "text,rating,source\n" +
      raw
        .map(
          (r: { text: string; rating: number; source: string }) =>
            `"${r.text}",${r.rating},"${r.source}"`,
        )
        .join("\n");
    const table = parseCSV(csv);
    const prepared = prepareReviews(
      mapColumns(
        table.rows,
        { text: "text", rating: "rating", date: "", title: "" },
        "NON-CUSTOMER fixture",
      ),
    );
    expect(prepared.rejected).toEqual([]);
    expect(prepared.reviews).toHaveLength(count);
    expect(prepared.reviews.filter((r) => r.nearDuplicateOf)).toHaveLength(0);
    let calls = 0;
    const provider: ModelProvider = {
      extract: async (reviews) => {
        calls++;
        expect(reviews.length).toBeLessThanOrEqual(6);
        return {
          records: reviews.map((r) => ({
            reviewId: r.id,
            sentiment: "positive",
            facts: [
              {
                category: "benefit",
                scope: "product",
                label: "Warm tea",
                quote: "the mug keeps tea warm",
              },
            ],
          })),
        };
      },
      group: async (records) => {
        calls++;
        expect(records.length).toBeLessThanOrEqual(10);
        return {
          groups: [
            {
              label: "Warm tea",
              factKeys: factCatalog(records).map((f) => f.key),
            },
          ],
        };
      },
      intelligence: async (themes) => {
        calls++;
        return {
          insights: [
            {
              category: "benefit",
              title: "Performance fixture only",
              description: "Synthetic result",
              themeIds: themes.map((t) => t.id),
            },
          ],
        };
      },
      angles: async (themes) => {
        calls++;
        return {
          angles: [
            {
              name: "Performance fixture only",
              type: "benefit",
              persona: "Test hypothesis",
              insight: "Synthetic",
              themeIds: themes.map((t) => t.id),
              hook: "Synthetic test",
              alternativeHooks: [],
              copy: "Synthetic test",
              ugc: "Synthetic test",
              firstThreeSeconds: "Synthetic test",
              cta: "Synthetic test",
            },
          ],
        };
      },
      followup: async () => {
        throw new Error("Not used");
      },
      translate: async () => {
        throw new Error("Not used");
      },
    };
    const now = new Date().toISOString();
    let p: Project = {
      id: crypto.randomUUID(),
      name: "NON-CUSTOMER volume validation",
      language: "ar",
      demo: true,
      createdAt: now,
      updatedAt: now,
      reviews: prepared.reviews,
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
        model: "deterministic-load-test-double",
        scoreVersion: "v1",
      },
    };
    for (let i = 0; i < 60 && p.run.stage !== "complete"; i++)
      p = await advance(p, provider);
    expect(p.run.stage).toBe("complete");
    expect(p.run.error).toBeUndefined();
    expect(calls).toBe(Math.ceil(count / 6) + Math.ceil(count / 10) + 2);
    expect(p.themes).toHaveLength(1);
    expect(p.themes[0].count).toBe(count);
    expect(p.angles[0].reviewIds).toHaveLength(count);
    expect(p.angles[0].score).toBe(70);
    for (const q of p.themes[0].quotes)
      expect(p.reviews.find((r) => r.id === q.reviewId)!.masked).toContain(
        q.quote,
      );
    const durationMs = Math.round(performance.now() - started);
    expect(durationMs).toBeLessThan(10_000);
    if (process.env.WRITE_VALIDATION_REPORT === "true") {
      await mkdir(".local/validation", { recursive: true });
      await writeFile(
        `.local/validation/load-${count}.json`,
        JSON.stringify(
          {
            count,
            durationMs,
            boundedModelCalls: calls,
            paidRequests: 0,
            model: "deterministic test double",
            provenance: "NON-CUSTOMER performance-only data",
            evidenceVerified: true,
          },
          null,
          2,
        ),
      );
    }
  },
);
