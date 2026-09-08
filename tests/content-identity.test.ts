import { it, expect } from "vitest";
import {
  comparisonText,
  validateClaims,
  validateAngle,
} from "../src/lib/analysis/guardrails";
import {
  creativeDevice,
  experientialTestimony,
  targetConcepts,
} from "../src/lib/analysis/content-identity";
import type { Theme } from "../src/lib/analysis/schema";
const theme = (quote: string): Theme => ({
  id: "t",
  label: quote,
  category: "benefit",
  scope: "product",
  count: 1,
  reviewIds: ["r"],
  quotes: [{ reviewId: "r", quote }],
});
const check = (text: string, quote = "Soft fabric") =>
  validateClaims({ copy: text }, ["t"], [theme(quote)], "angle");
it("allows exact visibly attributed customer quotations, not invented quoted testimony", () => {
  expect(
    check('Customer quote: "I used this."', "I used this.").some(
      (x) => x.code === "claim.creator-provenance",
    ),
  ).toBe(false);
  expect(
    check('Customer quote: "I used this."', "It was soft.").some(
      (x) => x.code === "claim.creator-provenance",
    ),
  ).toBe(true);
});
it.each([
  "I used this product.",
  "I have tried this.",
  "After using it, I noticed results.",
  "My lashes changed.",
  "It worked for me.",
  "أنا جربته",
  "استخدمته",
  "اشتريته",
  "حطيته",
  "لاحظت نتيجة",
  "فرق معايا",
  "رموشي بقت",
  "جربت المنتج",
  "مع شخص بيحكي تجربته الشخصية مع المنتج",
])("rejects invented experience: %s", (text) =>
  expect(experientialTestimony(comparisonText(text))).toBe(true),
);
it.each([
  "Try the product yourself.",
  "A hypothetical scene showing the package.",
  "Show the texture without a personal testimonial.",
  "Neutral presenter explains the product.",
  "شوف الخامة بنفسك",
  "لقطة افتراضية للمنتج على الترابيزة",
  "المقدم بيشرح تفاصيل العبوة",
])("allows neutral/second-person concept: %s", (text) =>
  expect(experientialTestimony(comparisonText(text))).toBe(false),
);
it.each([
  ["Eyelash care", "Nail serum"],
  ["Nail care", "Eyelash serum"],
  ["للعناية بالرموش", "سيروم الأظافر"],
  ["عناية بالأظافر", "سيروم الرموش"],
  ["Care for your lashes", "A nice product"],
])("rejects unsupported target %s", (text, quote) =>
  expect(check(text, quote).map((x) => x.code)).toContain(
    "claim.target-unsupported",
  ),
);
it("accepts supported targets and avoids word-fragment matches", () => {
  expect(check("Eyelash care", "Eyelash serum")).toEqual([]);
  expect(check("للعناية بالرموش", "سيروم الرموش")).toEqual([]);
  expect(
    targetConcepts(comparisonText("handmade footnote hairstyle interface")),
  ).toEqual([]);
});
it.each([
  "الملمس بيفرق معاك؟",
  "خامة ناعمة ومريحة",
  "فرق الملمس يهمك",
  "إحساس خفيف وطري",
  "The texture makes a difference.",
])("does not misclassify sensory wording %s", (text) =>
  expect(check(text).some((x) => x.code === "claim.visual-unsupported")).toBe(
    false,
  ),
);
it.each([
  "هتشوفي الفرق",
  "النتيجة باينة",
  "Visible results",
  "Looks different",
])("retains explicit visual-results guard %s", (text) =>
  expect(check(text).map((x) => x.code)).toContain("claim.visual-unsupported"),
);
const a = (name: string, ugc: string) => ({
  name,
  type: "Benefit",
  persona: "Interested buyer",
  insight: name,
  themeIds: ["t"],
  hook: name,
  alternativeHooks: [],
  copy: name,
  ugc,
  firstThreeSeconds: ugc,
  cta: "View details",
});
it("identifies review cards with different claims, preserving materially different execution", () => {
  const first = a("Soft texture", "Show a review card beside the product");
  const second = a(
    "Gift choice",
    "Display a testimonial card with customer wording",
  );
  expect(
    validateAngle(second, [theme("Soft fabric")], "en", [first]).map(
      (x) => x.code,
    ),
  ).toContain("angle.duplicate-execution");
  expect(
    validateAngle(
      a("Gift choice", "Unboxing a wrapped gift"),
      [theme("Soft fabric")],
      "en",
      [first],
    ).some((x) => x.code === "angle.duplicate-execution"),
  ).toBe(false);
  expect(
    creativeDevice(comparisonText("إظهار عبارة المراجعة على الشاشة")),
  ).toBe("review-card");
});
