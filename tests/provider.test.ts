import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse: mock.parse };
  },
}));
import { OpenAIProvider } from "../src/lib/analysis/provider";
import { prepareReviews } from "../src/lib/ingestion";
import type { Theme } from "../src/lib/analysis/schema";
beforeEach(() => mock.parse.mockReset());
it("uses Responses structured outputs with storage disabled and only masked review data", async () => {
  const reviews = prepareReviews([
    { text: "Useful bottle. Please contact me at person@example.com." },
  ]).reviews;
  mock.parse.mockResolvedValue({
    output_parsed: {
      records: [{ reviewId: reviews[0].id, sentiment: "positive", facts: [] }],
    },
  });
  await new OpenAIProvider().extract(reviews);
  const request = mock.parse.mock.calls[0][0];
  expect(request.store).toBe(false);
  expect(request.text.format.type).toBe("json_schema");
  expect(request.text.format.strict).toBe(true);
  expect(request.input[1].content).not.toContain("person@example.com");
  expect(request.input[1].content).toContain("[EMAIL]");
  expect(request.input[0].content).toContain("UNTRUSTED DATA");
});
it("reports refusals/incomplete model output instead of accepting empty results", async () => {
  mock.parse.mockResolvedValue({ output_parsed: null });
  await expect(new OpenAIProvider().extract([])).rejects.toThrow(
    "valid analysis",
  );
});
it("schema-validates even a malformed mocked provider result", async () => {
  mock.parse.mockResolvedValue({
    output_parsed: {
      records: [{ reviewId: "r1", sentiment: "invented", facts: [] }],
    },
  });
  await expect(new OpenAIProvider().extract([])).rejects.toThrow();
});

it.each(["intelligence", "angles"] as const)(
  "%s constrains generated references to supplied evidence before requesting model output",
  async (method) => {
    const themes: Theme[] = [
      {
        id: "theme-available",
        label: "تشغيل هادئ",
        category: "benefit",
        scope: "product",
        reviewIds: ["review-1"],
        count: 1,
        quotes: [{ reviewId: "review-1", quote: "تشغيل هادئ" }],
      },
    ];
    const insight = {
      category: "benefit",
      title: "هدوء",
      description: "تشغيل هادئ",
      themeIds: ["theme-typo"],
    };
    const angle = {
      name: "هدوء",
      type: "فائدة",
      persona: "فرضية",
      insight: "تشغيل هادئ",
      themeIds: ["theme-typo"],
      hook: "تشغيل هادئ",
      alternativeHooks: [],
      copy: "تشغيل هادئ",
      ugc: "تصوير من فوق للمنتج",
      firstThreeSeconds: "لقطة من فوق للمنتج",
      cta: "شاهد التفاصيل",
    };
    mock.parse.mockResolvedValue({
      output_parsed:
        method === "intelligence"
          ? { insights: [insight] }
          : { angles: [angle] },
    });
    await expect(new OpenAIProvider()[method](themes, "ar")).rejects.toThrow();
    const schema = mock.parse.mock.calls[0][0].text.format.schema;
    const collection = method === "intelligence" ? "insights" : "angles";
    const reference = schema.properties[collection].items.properties.themeIds;
    expect(reference.minItems).toBe(1);
    expect(reference.items.enum ?? [reference.items.const]).toEqual([
      "theme-available",
    ]);
    const valid =
      method === "intelligence"
        ? { insights: [{ ...insight, themeIds: ["theme-available"] }] }
        : { angles: [{ ...angle, themeIds: ["theme-available"] }] };
    mock.parse.mockResolvedValue({ output_parsed: valid });
    await expect(new OpenAIProvider()[method](themes, "ar")).resolves.toEqual(
      valid,
    );
  },
);
