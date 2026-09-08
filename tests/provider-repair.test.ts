import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse: mock.parse };
  },
}));
import { OpenAIProvider } from "../src/lib/analysis/provider";
import type { Theme } from "../src/lib/analysis/schema";
const themes: Theme[] = ["quiet", "soft", "unrelated"].map((id) => ({
  id,
  label: id,
  category: "benefit",
  scope: "product",
  count: 1,
  reviewIds: [id + "-review"],
  quotes: [
    {
      reviewId: id + "-review",
      quote:
        id === "unrelated"
          ? "UNRELATED PRIVATE FIXTURE"
          : id === "quiet"
            ? "تشغيل هادئ."
            : "قماش ناعم.",
    },
  ],
}));
const candidate = (id: string, copy: string) => ({
  name: copy,
  hook: copy,
  copy,
  type: "فائدة",
  persona: "متسوقون مهتمون",
  insight: copy,
  themeIds: [id],
  alternativeHooks: [],
  ugc: id === "quiet" ? "اعرض المروحة بجوار كتاب" : "تغليف هدية بالقماش",
  firstThreeSeconds:
    id === "quiet" ? "لقطة قريبة للمروحة" : "لقطة قريبة لشريط الهدية",
  cta: "شاهد التفاصيل",
});
const good = candidate("quiet", "تشغيل هادئ."),
  bad = candidate("soft", "راحة مضمونة."),
  fixed = candidate("soft", "قماش ناعم.");
it("resumes saved valid items without a whole-set request or regeneration", async () => {
  const provider = new OpenAIProvider();
  expect((await provider.repairAngles([good], themes, "ar")).angles).toEqual([
    good,
  ]);
  expect(mock.parse).not.toHaveBeenCalled();
});
beforeEach(() => {
  mock.parse.mockReset();
  vi.stubEnv("OPENAI_MODEL_FAST", "fast");
  vi.stubEnv("OPENAI_MODEL_QUALITY", "quality");
  vi.stubEnv("OPENAI_MODEL_FALLBACK", "fallback");
});
afterEach(() => vi.unstubAllEnvs());
const response = (output_parsed: unknown) => ({
  output_parsed,
  usage: {
    input_tokens: 100,
    output_tokens: 20,
    output_tokens_details: { reasoning_tokens: 5 },
  },
});
it("routes only the failed item to QUALITY then FALLBACK using restricted evidence, preserving the passing item", async () => {
  mock.parse
    .mockResolvedValueOnce(response(bad))
    .mockResolvedValueOnce(response(fixed));
  const provider = new OpenAIProvider();
  const result = await provider.repairAngles([bad, good], themes, "ar");
  expect(result.angles).toEqual([good, fixed]);
  expect(mock.parse.mock.calls.map((c) => c[0].model)).toEqual([
    "quality",
    "fallback",
  ]);
  for (const [request, options] of mock.parse.mock.calls) {
    const data = JSON.parse(request.input[1].content);
    expect(data.themes.map((t: Theme) => t.id)).toEqual(["soft"]);
    expect(data.candidate.themeIds).toEqual(["soft"]);
    expect(request.input[1].content).not.toContain("UNRELATED PRIVATE FIXTURE");
    expect(data.accepted).toHaveLength(1);
    expect(
      request.text.format.schema.properties.themeIds.items.const ??
        request.text.format.schema.properties.themeIds.items.enum?.[0],
    ).toBe("soft");
    expect(options.maxRetries).toBe(0);
  }
  expect(provider.telemetry.usage.map((x) => x.model)).toEqual([
    "quality",
    "fallback",
  ]);
  expect(JSON.stringify(provider.telemetry)).not.toContain(
    "Guaranteed comfort",
  );
  expect(
    provider.telemetry.selection.filter(
      (x) => x.attempt === "initial" && x.passed,
    ),
  ).toHaveLength(1);
});
it("never calls FALLBACK if initial or targeted QUALITY output passes", async () => {
  mock.parse.mockResolvedValueOnce(response(fixed));
  expect(
    (await new OpenAIProvider().repairAngles([good, bad], themes, "ar")).angles,
  ).toHaveLength(2);
  expect(mock.parse).toHaveBeenCalledTimes(1);
  expect(mock.parse.mock.calls.map((c) => c[0].model)).toEqual(["quality"]);
});
it("disabled fallback omits only the failed item", async () => {
  vi.stubEnv("OPENAI_MODEL_FALLBACK", undefined);
  mock.parse.mockResolvedValueOnce(response(bad));
  expect(
    (await new OpenAIProvider().repairAngles([good, bad], themes, "ar")).angles,
  ).toEqual([good]);
  expect(mock.parse).toHaveBeenCalledTimes(1);
});
it("invalid intelligence is repaired per item and omitted after failed fallback", async () => {
  const valid = {
    title: "تشغيل هادئ",
    description: "تشغيل هادئ",
    category: "benefit",
    themeIds: ["quiet"],
  };
  const invalid = {
    ...valid,
    title: "نتائج مضمونة",
    description: "نتائج مضمونة",
  };
  mock.parse
    .mockResolvedValueOnce(response({ insights: [valid, invalid] }))
    .mockResolvedValueOnce(response(invalid))
    .mockResolvedValueOnce(response(invalid));
  expect(
    (await new OpenAIProvider().intelligence(themes, "ar")).insights,
  ).toEqual([valid]);
  expect(mock.parse).toHaveBeenCalledTimes(3);
});
it("a followup cannot cite an out-of-envelope review or reintroduce guarantees; unsafe final output is not returned", async () => {
  const angle = {
    ...good,
    id: "a",
    reviewIds: ["quiet-review"],
    score: 40,
    scoreBreakdown: {},
    strength: "limited" as const,
    saved: false,
  };
  const unsafe = {
    content: "Guaranteed cooling every day.",
    reviewIds: ["unrelated-review"],
  };
  mock.parse.mockResolvedValue(response(unsafe));
  await expect(
    new OpenAIProvider().followup(angle, [], "hooks", "ar", themes),
  ).rejects.toThrow("No unsafe content");
  expect(mock.parse).toHaveBeenCalledTimes(3);
  for (const [request] of mock.parse.mock.calls)
    expect(request.input[1].content).not.toContain("UNRELATED PRIVATE FIXTURE");
});
