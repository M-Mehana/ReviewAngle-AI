import { describe, expect, it } from "vitest";
import { advance } from "../src/lib/analysis/pipeline";
import { demoProvider } from "../src/lib/analysis/demo-provider";
import { fixtures } from "../src/lib/fixtures";
import { prepareReviews } from "../src/lib/ingestion";
import type { Project } from "../src/lib/analysis/schema";
import type { ModelProvider } from "../src/lib/analysis/provider";
export function project(): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Synthetic test",
    language: "en",
    demo: true,
    createdAt: now,
    updatedAt: now,
    reviews: prepareReviews(fixtures("mixed")).reviews,
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
}
describe("staged pipeline with a deterministic model double", () => {
  it("runs through bounded batches with traceable quotes/counts and no paid calls", async () => {
    let p = project();
    let calls = 0;
    const provider: ModelProvider = {
      ...demoProvider,
      extract: async (reviews) => {
        expect(reviews.length).toBeLessThanOrEqual(6);
        calls++;
        return demoProvider.extract(reviews);
      },
    };
    for (let i = 0; i < 10 && p.run.stage !== "complete"; i++)
      p = await advance(p, provider);
    expect(p.run.error).toBeUndefined();
    expect(p.run.stage).toBe("complete");
    expect(calls).toBe(2);
    expect(p.extractions).toHaveLength(12);
    expect(p.angles.length).toBeGreaterThan(0);
    for (const a of p.angles) {
      expect(a.reviewIds.length).toBeGreaterThan(0);
      expect(a.score).toBeLessThanOrEqual(100);
      expect(
        a.reviewIds.every((id) => p.reviews.some((r) => r.id === id)),
      ).toBe(true);
    }
    for (const t of p.themes) {
      expect(t.count).toBe(new Set(t.reviewIds).size);
      expect(
        t.quotes.every((q) =>
          p.reviews.find((r) => r.id === q.reviewId)!.masked.includes(q.quote),
        ),
      ).toBe(true);
    }
  });
  it("saves a failed stage and resumes without reprocessing successful reviews", async () => {
    let p = await advance(project(), demoProvider);
    const failing: ModelProvider = {
      ...demoProvider,
      extract: async () => {
        throw new Error("Temporary API failure");
      },
    };
    p = await advance(p, failing);
    expect(p.run.stage).toBe("failed");
    expect(p.extractions).toHaveLength(6);
    p = await advance(p, demoProvider);
    expect(p.run.stage).toBe("themes");
    expect(p.extractions).toHaveLength(12);
  });
  it("marks omitted model records as partial failures", async () => {
    const p = await advance(project(), {
      ...demoProvider,
      extract: async () => ({ records: [] }),
    });
    expect(p.run.failedReviewIds).toHaveLength(6);
    expect(p.run.processed).toBe(0);
  });
  it("rejects fabricated angle references", async () => {
    let p = project();
    for (let i = 0; i < 8 && p.run.stage !== "angles"; i++)
      p = await advance(p, demoProvider);
    p = await advance(p, {
      ...demoProvider,
      angles: async () => ({
        angles: [
          {
            name: "Unsupported",
            type: "test",
            persona: "nobody",
            insight: "invented",
            themeIds: ["fake"],
            hook: "fake",
            alternativeHooks: [],
            copy: "fake",
            ugc: "fake",
            firstThreeSeconds: "fake",
            cta: "fake",
          },
        ],
      }),
    });
    expect(p.run.stage).toBe("failed");
    expect(p.angles).toHaveLength(0);
    expect(p.run.error).toContain("missing evidence");
  });
  it("refuses to pass arbitrary customer data through the synthetic fixture provider", async () => {
    const p = project();
    p.reviews = prepareReviews([
      { text: "This is my real customer review." },
    ]).reviews;
    expect((await advance(p, demoProvider)).run.stage).toBe("failed");
  });
});
