import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse: mock.parse };
  },
}));
import { OpenAIProvider } from "../src/lib/analysis/provider";
import { prepareReviews } from "../src/lib/ingestion";
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
