import { expect, it, vi } from "vitest";
import { ImportSchema } from "../src/lib/server/service";
import {
  outputLanguages,
  defaultOutputLanguage,
  detectLanguage,
  direction,
  localizationPrompt,
  requireCurrentOutput,
} from "../src/lib/language";
import { prepareReviews, parseCSV } from "../src/lib/ingestion";
import { advance } from "../src/lib/analysis/pipeline";
import { demoProvider } from "../src/lib/analysis/demo-provider";
import { fixtures } from "../src/lib/fixtures";
import type { Project } from "../src/lib/analysis/schema";
it("allows only the three Arabic output locales and defaults to neutral Arabic", () => {
  expect(outputLanguages).toEqual(["ar", "ar-EG", "ar-SA"]);
  expect(defaultOutputLanguage).toBe("ar");
  expect(
    ImportSchema.safeParse({
      name: "Synthetic",
      language: "en",
      reviews: [{ text: "A synthetic review." }],
    }).success,
  ).toBe(false);
  expect(() => localizationPrompt("en")).toThrow(/legacy/);
});
it.each(outputLanguages)(
  "English source remains original with %s output",
  async (language) => {
    const original = fixtures("en");
    const reviews = prepareReviews(original).reviews;
    expect(reviews.every((r) => r.language === "en")).toBe(true);
    expect(
      ImportSchema.safeParse({ name: "Synthetic", language, reviews: original })
        .success,
    ).toBe(true);
    let p: Project = {
      id: "synthetic",
      name: "Synthetic",
      language,
      demo: true,
      createdAt: "",
      updatedAt: "",
      reviews,
      extractions: [],
      themes: [],
      insights: [],
      angles: [],
      followups: [],
      run: {
        id: "run",
        stage: "ready",
        processed: 0,
        failedReviewIds: [],
        model: "fixture",
        scoreVersion: "v1",
      },
    };
    for (let i = 0; i < 20 && p.run.stage !== "complete"; i++)
      p = await advance(p, demoProvider);
    expect(p.run.stage).toBe("complete");
    expect(p.angles.length).toBeGreaterThan(0);
    expect(p.angles.every((a) => /[\u0600-\u06ff]/.test(a.copy))).toBe(true);
    expect(p.reviews.map((r) => r.text)).toEqual(reviews.map((r) => r.text));
    for (const t of p.themes)
      for (const q of t.quotes)
        expect(p.reviews.find((r) => r.id === q.reviewId)!.text).toContain(
          q.quote,
        );
    expect(direction(language)).toBe("rtl");
    expect(localizationPrompt(language)).toMatch(/[\u0600-\u06ff]/);
  },
);
it("retains separate source detection including mixed and unknown", () => {
  expect(detectLanguage("A fictional English review")).toBe("en");
  expect(detectLanguage("نص عربي تجريبي")).toBe("ar");
  expect(detectLanguage("English عربي تجريبي")).toBe("mixed");
  expect(detectLanguage("123")).toBe("und");
});
it("legacy projects are typed/readable but cannot resume generation", async () => {
  const provider = { ...demoProvider, extract: vi.fn() };
  const p = { language: "en", run: { stage: "ready" } } as Project;
  expect(direction(p.language)).toBe("ltr");
  expect(() => requireCurrentOutput(p.language)).toThrow(/legacy/);
  await expect(advance(p, provider)).rejects.toThrow(/legacy/);
  expect(provider.extract).not.toHaveBeenCalled();
});

it("parses English source CSV without translation", () => {
  const csv = parseCSV('text,rating\n"Synthetic English source review",4');
  expect(JSON.stringify(csv)).toContain("Synthetic English source review");
});
