import { describe, expect, it } from "vitest";
import { detectLanguage, direction } from "../src/lib/language";
import {
  mapColumns,
  maskPII,
  normalize,
  parseCSV,
  parsePaste,
  prepareReviews,
} from "../src/lib/ingestion";
import { publicIP, validateURL } from "../src/lib/connectors/security";
import { aggregate } from "../src/lib/analysis/aggregate";
import {
  scoreEvidence,
  validateExtractions,
} from "../src/lib/analysis/evidence";
import type { Extraction } from "../src/lib/analysis/schema";
import { csvExport } from "../src/lib/exports";
describe("normalization and input", () => {
  it("removes active HTML, whitespace and bidi controls while retaining Arabic", () =>
    expect(
      normalize("<script>bad()</script><p>  جميل&nbsp; جداً </p>\n\u202e"),
    ).toBe("جميل جداً"));
  it("preserves originals and assigns stable IDs at ingestion", () => {
    const { reviews } = prepareReviews([
      { text: "<b>Great useful bottle</b>" },
    ]);
    expect(reviews[0].text).toBe("<b>Great useful bottle</b>");
    expect(reviews[0].normalized).toBe("Great useful bottle");
    expect(reviews[0].id).toMatch(/^[a-f0-9-]{36}$/);
  });
  it("masks emails and international/Arabic phone numbers", () =>
    expect(maskPII("me@example.com +20 100 123 4567 or ٠١٠١٢٣٤٥٦٧٨")).toBe(
      "[EMAIL] [PHONE] or [PHONE]",
    ));
  it("rejects empty rows and exact duplicate punctuation variants", () => {
    const result = prepareReviews([
      { text: "  " },
      { text: "<p>Useful bottle!</p>" },
      { text: "useful bottle" },
    ]);
    expect(result.reviews).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
  });
  it("flags practical near duplicates without silently deleting originals", () => {
    const result = prepareReviews([
      { text: "This bottle keeps my coffee warm all day at the office" },
      { text: "This bottle keeps my coffee warm all day at the office today" },
    ]);
    expect(result.reviews).toHaveLength(2);
    expect(result.reviews[1].nearDuplicateOf).toBe(result.reviews[0].id);
  });
  it("parses quoted CSV fields, multiline values and Arabic headers", () => {
    const parsed = parseCSV(
      'نص,تقييم\r\n"ممتاز،\nوسهل",5\r\n"Great, useful",4',
    );
    expect(parsed.rows).toHaveLength(2);
    const rows = mapColumns(parsed.rows, { text: "نص", rating: "تقييم" });
    expect(rows[0].text).toContain("\n");
    expect(rows[1].rating).toBe(4);
  });
  it("requires text mapping and rejects malformed CSV", () => {
    expect(() => mapColumns([{ rating: "5" }], { text: "body" })).toThrow(
      "column",
    );
    expect(() => parseCSV('text,rating\n"bad,5')).toThrow("Invalid CSV");
    expect(() => parseCSV("text,rating")).toThrow("no data");
  });
  it("splits paragraphs rather than wrapped lines", () =>
    expect(parsePaste("review one\nwrapped\n\nreview two")).toHaveLength(2));
});
describe("language direction", () => {
  it("handles dialects and mixed language", () => {
    expect(direction("ar-EG")).toBe("rtl");
    expect(direction("ar-SA")).toBe("rtl");
    expect(direction("en")).toBe("ltr");
    expect(detectLanguage("منتج جميل ومريح")).toBe("ar");
    expect(detectLanguage("A useful product")).toBe("en");
    expect(detectLanguage("جميل جداً useful product")).toBe("mixed");
    expect(detectLanguage("123")).toBe("und");
  });
});
describe("URL security", () => {
  it.each([
    "http://localhost",
    "http://127.0.0.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://10.1.2.3",
    "http://169.254.169.254",
    "http://172.16.0.1",
    "http://192.168.1.1",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "http://[fc00::1]",
    "file:///etc/passwd",
    "ftp://example.com",
    "https://user:pass@example.com",
    "https://example.com:8080",
    "http://foo.internal",
  ])("rejects %s", (input) => expect(() => validateURL(input)).toThrow());
  it("allows only globally routable DNS answers", () => {
    expect(publicIP("8.8.8.8")).toBe(true);
    expect(publicIP("100.64.0.1")).toBe(false);
    expect(publicIP("192.0.2.1")).toBe(false);
    expect(publicIP("224.0.0.1")).toBe(false);
    expect(publicIP("2001:db8::1")).toBe(false);
    expect(publicIP("::ffff:8.8.8.8")).toBe(false);
    expect(publicIP("2606:4700:4700::1111")).toBe(true);
  });
  it("accepts ordinary HTTPS pages", () =>
    expect(validateURL("https://example.com/products/bottle").hostname).toBe(
      "example.com",
    ));
});
describe("evidence", () => {
  const reviews = prepareReviews([
    {
      text: "This useful bottle keeps coffee warm throughout my morning commute.",
    },
  ]).reviews;
  const record: Extraction = {
    reviewId: reviews[0].id,
    sentiment: "positive",
    facts: [
      {
        category: "benefit",
        label: "Warm coffee",
        quote: reviews[0].masked,
        scope: "product",
      },
    ],
  };
  it("rejects fake IDs and discards fabricated quotes", () => {
    expect(() =>
      validateExtractions([{ ...record, reviewId: "fake" }], reviews),
    ).toThrow();
    expect(
      validateExtractions(
        [
          {
            ...record,
            facts: [{ ...record.facts[0], quote: "Invented quote" }],
          },
        ],
        reviews,
      )[0].facts,
    ).toHaveLength(0);
  });
  it("counts distinct IDs even when a review repeats a fact", () => {
    const e = { ...record, facts: [...record.facts, ...record.facts] };
    const themes = aggregate(
      [e],
      [
        {
          label: "Warm coffee",
          factKeys: [`${record.reviewId}:0`, `${record.reviewId}:1`],
        },
      ],
    );
    expect(themes[0].count).toBe(1);
    expect(themes[0].quotes).toHaveLength(1);
  });
  it("caps weak samples and returns 0 without evidence", () => {
    const themes = aggregate([record], []);
    expect(
      scoreEvidence([record.reviewId], [themes[0].id], themes, [record]).score,
    ).toBe(40);
    expect(scoreEvidence([], [], [], []).score).toBe(0);
  });
  it("does not reward invented or duplicated IDs", () => {
    const themes = aggregate([record], []);
    expect(
      scoreEvidence(
        [record.reviewId, record.reviewId, "fake"],
        [themes[0].id],
        themes,
        [record],
      ).score,
    ).toBe(40);
  });
  it("escapes spreadsheet formula injection", () => {
    const result = csvExport({
      angles: [
        {
          name: '=HYPERLINK("bad")',
          type: "test",
          persona: "p",
          insight: "i",
          score: 40,
          reviewIds: ["r1"],
          hook: "+cmd",
          alternativeHooks: [],
          copy: "c",
          ugc: "u",
          firstThreeSeconds: "s",
          cta: "go",
        },
      ],
      demo: true,
    } as never);
    expect(result).toContain("'=HYPERLINK");
    expect(result).toContain("'+cmd");
  });
});
