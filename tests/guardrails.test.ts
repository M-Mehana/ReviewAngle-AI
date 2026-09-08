import { expect, it } from "vitest";
import {
  comparisonText,
  duplicate,
  localized,
  validateAngle,
  validateClaims,
  validateInsight,
  type AngleCandidate,
} from "../src/lib/analysis/guardrails";
import type { Theme } from "../src/lib/analysis/schema";
const theme = (quote: string, extra: Partial<Theme> = {}): Theme => ({
  id: "t",
  label: "Synthetic fixture",
  category: "benefit",
  scope: "product",
  count: 1,
  reviewIds: ["r"],
  quotes: [{ reviewId: "r", quote }],
  ...extra,
});
const angle = (
  text: string,
  extra: Partial<AngleCandidate> = {},
): AngleCandidate => ({
  name: text,
  type: "benefit",
  persona: "For interested shoppers",
  insight: text,
  themeIds: ["t"],
  hook: text,
  alternativeHooks: [],
  copy: text,
  ugc: "Show the product on a table",
  firstThreeSeconds: "Product on a table",
  cta: "View details",
  ...extra,
});
const codes = (text: string, quote: string) =>
  validateClaims({ copy: text }, ["t"], [theme(quote)], "angle").map(
    (x) => x.code,
  );
it.each([
  [
    "It will enter her routine every day.",
    "She liked the gift.",
    "frequency-recommendation",
  ],
  ["Use it every day.", "I used it daily.", "frequency-recommendation"],
  ["هتدخل في روتينها كل يوم", "She loved the gift", "frequency-recommendation"],
  ["Visible results in 7 days.", "I saw a difference.", "timeline-unsupported"],
  ["Keeps you cool.", "It is comfortable.", "cooling-unsupported"],
  ["Durable material.", "It is soft.", "durability-unsupported"],
  ["Perfect fit for everyone.", "It fitted me.", "absolute"],
  ["هيوصلك بسرعة", "My order arrived quickly.", "scope.shipping-promise"],
  ["Guaranteed results.", "I liked it.", "absolute"],
  ["Treats skin problems.", "My skin felt nice.", "medical"],
  ["هتشوفي الفرق", "The box was nice.", "visual-unsupported"],
] as const)("rejects %s", (text, quote, code) =>
  expect(codes(text, quote).some((x) => x.endsWith(code))).toBe(true),
);
it("does not join an outcome and timeframe from separate quotes/reviews", () => {
  const themes = [
    theme("Visible results.", { id: "a" }),
    theme("I used it for 7 days.", {
      id: "b",
      reviewIds: ["r2"],
      quotes: [{ reviewId: "r2", quote: "I used it for 7 days." }],
    }),
  ];
  expect(
    validateClaims(
      { copy: "A customer reported visible results in 7 days." },
      ["a", "b"],
      themes,
      "angle",
    ).map((x) => x.code),
  ).toContain("claim.timeline-unsupported");
});
it("allows appropriately attributed outcome and timeframe in the same exact quote", () => {
  expect(
    codes(
      "A customer reported visible results in 7 days.",
      "I saw visible results in 7 days.",
    ),
  ).toEqual([]);
  expect(
    codes("ذكرت عميلة نتيجة ملحوظة بعد أسبوعين", "نتيجة ملحوظة بعد أسبوعين"),
  ).toEqual([]);
});
it("does not authorize a synthetic before/after visual from a written result", () => {
  expect(
    validateClaims(
      { ugc: "Show before and after visible results." },
      ["t"],
      [theme("Visible results in 7 days.")],
      "angle",
    ).map((x) => x.code),
  ).toContain("claim.visual-proof-invented");
});
it("only allows attributed personal frequency with supporting evidence", () => {
  expect(codes("One reviewer reported daily use.", "I used it daily.")).toEqual(
    [],
  );
  expect(codes("One reviewer reported daily use.", "It was nice.")).toContain(
    "claim.frequency-recommendation",
  );
});
it("keeps shipping descriptions scoped; rejects product use of shipping and mixed-scope support", () => {
  const shipping = theme("My delivery was quick.", { scope: "shipping" });
  expect(
    validateClaims(
      { copy: "A comfortable product." },
      ["t"],
      [shipping],
      "angle",
    ).map((x) => x.code),
  ).toContain("scope.product-required");
  expect(
    validateInsight(
      {
        title: "Shipping experiences",
        description: "Customers reported delivery experiences.",
        category: "objection",
        themeIds: ["t"],
      },
      [shipping],
      "en",
    ),
  ).toEqual([]);
  expect(
    validateClaims(
      { copy: "Comfortable." },
      ["t", "p"],
      [shipping, theme("Comfortable.", { id: "p" })],
      "angle",
    ).map((x) => x.code),
  ).toContain("scope.product-required");
});
it("rejects general fit and durability even when a personal quote mentions them", () => {
  expect(codes("Perfect fit.", "It was a perfect fit for me.")).toContain(
    "claim.fit-generalized",
  );
  expect(codes("Durable.", "It seemed durable to me.")).toContain(
    "claim.durability-generalized",
  );
  expect(
    codes("A reviewer described it as durable.", "It seemed durable to me."),
  ).toEqual([]);
});
it("detects duplicate comfort and repurchase concepts despite different type labels", () => {
  expect(
    duplicate(
      angle("Comfortable all day"),
      angle("Comfort you can live in", { type: "Lifestyle" }),
      [theme("Comfortable.")],
    ),
  ).toBe(true);
  expect(
    duplicate(
      angle("Customers buy another one"),
      angle("You will want a second one", { type: "Loyalty" }),
      [theme("Bought another.")],
    ),
  ).toBe(true);
});
it("preserves different buyer motivations and reasonable Arabic spelling comparisons", () => {
  expect(
    duplicate(
      angle("A birthday gift", {
        ugc: "Wrap a gift box with ribbon",
        firstThreeSeconds: "Open a birthday card",
      }),
      angle("Quiet operation"),
      [theme("Quiet operation.")],
    ),
  ).toBe(false);
  expect(comparisonText("رَاحــة")).toBe(comparisonText("راحه"));
});
it("leaves grounded English intact", () =>
  expect(
    validateAngle(angle("Quiet operation."), [theme("Quiet operation.")], "en"),
  ).toEqual([]));
it("checks every visible localized field, allowing brand names in Arabic prose", () => {
  const fields = {
    name: "راحة البيت",
    type: "فكرة للراحة",
    persona: "للي بتحب الراحة",
    insight: "التقييمات بتتكلم عن الراحة",
    hook: "خدي راحتك",
    alternativeHooks: "وقت الراحة",
    copy: "راحة مع Oodie",
    ugc: "لقطة للمنتج",
    firstThreeSeconds: "صورة المنتج",
    cta: "شوفي التفاصيل",
  };
  expect(localized(fields, "ar-EG")).toEqual([]);
  for (const field of Object.keys(fields))
    expect(
      localized(
        { ...fields, [field]: "Benefit-led comfort for your routine" },
        "ar-EG",
      ).some((e) => e.field === field),
    ).toBe(true);
  expect(
    localized({ ...fields, copy: "يمكنك اختيار ما يناسبك" }, "ar-EG"),
  ).toEqual([]);
});
it("applies claim guards to followups too", () =>
  expect(
    validateClaims(
      { content: "Use it daily. Guaranteed cooling." },
      ["t"],
      [theme("Soft.")],
      "followup",
    ).length,
  ).toBeGreaterThan(1));
