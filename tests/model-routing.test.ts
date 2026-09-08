import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse: mock.parse };
  },
}));
import {
  fallbackModel,
  modelForStage,
  OpenAIProvider,
} from "../src/lib/analysis/provider";
import { prepareReviews } from "../src/lib/ingestion";
import type { Angle } from "../src/lib/analysis/schema";
const reviews = prepareReviews([
  { text: "The fan is quiet while I read at my desk." },
]).reviews;
const angle: Angle = {
  id: "a",
  name: "Quiet",
  type: "benefit",
  persona: "Hypothesis",
  insight: "Quiet operation",
  themeIds: ["t"],
  hook: "Quiet operation",
  alternativeHooks: [],
  copy: "Quiet operation",
  ugc: "Product concept",
  firstThreeSeconds: "Product shot",
  cta: "View details",
  reviewIds: [reviews[0].id],
  score: 40,
  scoreBreakdown: {},
  strength: "limited",
  saved: false,
};
const themes = [
  {
    id: "t",
    label: "Quiet operation",
    scope: "product",
    category: "benefit" as const,
    count: 1,
    reviewIds: [reviews[0].id],
    quotes: [{ reviewId: reviews[0].id, quote: "quiet" }],
  },
];
const stages = [
  {
    name: "extract",
    tier: "FAST",
    call: (p: OpenAIProvider) => p.extract(reviews),
    output: { records: [] },
  },
  {
    name: "group",
    tier: "FAST",
    call: (p: OpenAIProvider) => p.group([], "ar"),
    output: { groups: [] },
  },
  {
    name: "intelligence",
    tier: "QUALITY",
    call: (p: OpenAIProvider) => p.intelligence([], "ar"),
    output: { insights: [] },
  },
  {
    name: "angles",
    tier: "QUALITY",
    call: (p: OpenAIProvider) => p.angles([], "ar-EG"),
    output: { angles: [] },
  },
  {
    name: "hooks",
    tier: "QUALITY",
    call: (p: OpenAIProvider) =>
      p.followup(angle, reviews, "hooks", "ar", themes),
    output: { content: "فكرة إعلانية", reviewIds: [reviews[0].id] },
  },
  {
    name: "UGC",
    tier: "QUALITY",
    call: (p: OpenAIProvider) =>
      p.followup(angle, reviews, "ugc", "ar", themes),
    output: { content: "لقطة للمنتج", reviewIds: [reviews[0].id] },
  },
  {
    name: "translation",
    tier: "QUALITY",
    call: (p: OpenAIProvider) => p.translate(reviews[0], "ar-EG"),
    output: { translation: "ترجمة" },
  },
];
beforeEach(() => {
  mock.parse.mockReset();
  vi.stubEnv("OPENAI_MODEL", "legacy-model");
  vi.stubEnv("OPENAI_MODEL_FALLBACK", undefined);
});
it("fallback is disabled unless explicitly configured, never inherited from legacy or QUALITY", () => {
  expect(fallbackModel()).toBeUndefined();
  vi.stubEnv("OPENAI_MODEL_FALLBACK", " ");
  expect(fallbackModel()).toBeUndefined();
  vi.stubEnv("OPENAI_MODEL_FALLBACK", " fallback-model ");
  expect(fallbackModel()).toBe("fallback-model");
});
afterEach(() => vi.unstubAllEnvs());
it.each(stages)(
  "$name selects its tier and preserves legacy fallback and request safeguards",
  async (stage) => {
    let originalSchema: unknown;
    for (const mode of ["split", "legacy", "blank"] as const) {
      vi.stubEnv(
        "OPENAI_MODEL_FAST",
        mode === "split" ? "fast-model" : mode === "blank" ? " " : undefined,
      );
      vi.stubEnv(
        "OPENAI_MODEL_QUALITY",
        mode === "split" ? "quality-model" : mode === "blank" ? "" : undefined,
      );
      mock.parse.mockResolvedValue({ output_parsed: stage.output });
      await stage.call(new OpenAIProvider());
      const request = mock.parse.mock.lastCall![0];
      expect(request.model, mode).toBe(
        mode === "split"
          ? stage.tier === "FAST"
            ? "fast-model"
            : "quality-model"
          : "legacy-model",
      );
      expect(request.store).toBe(false);
      expect(request.text.format.strict).toBe(true);
      expect(request.max_output_tokens).toBe(12000);
      if (mode === "split") originalSchema = request.text.format;
      else expect(request.text.format).toEqual(originalSchema);
    }
  },
);
it("an unset tier falls back to the legacy model, never the other tier", () => {
  vi.stubEnv("OPENAI_MODEL_FAST", "fast-model");
  vi.stubEnv("OPENAI_MODEL_QUALITY", undefined);
  expect(modelForStage("QUALITY")).toBe("legacy-model");
  vi.stubEnv("OPENAI_MODEL_FAST", undefined);
  vi.stubEnv("OPENAI_MODEL_QUALITY", "quality-model");
  expect(modelForStage("FAST")).toBe("legacy-model");
});
it("preserves the existing default when no model variables are supplied", () => {
  vi.stubEnv("OPENAI_MODEL", undefined);
  vi.stubEnv("OPENAI_MODEL_FAST", undefined);
  vi.stubEnv("OPENAI_MODEL_QUALITY", undefined);
  expect(modelForStage("FAST")).toBe("gpt-6-astra");
  expect(modelForStage("QUALITY")).toBe("gpt-6-astra");
});
