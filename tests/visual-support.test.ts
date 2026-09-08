import { it, expect } from "vitest";
import { validateClaims } from "../src/lib/analysis/guardrails";
import type { Theme } from "../src/lib/analysis/schema";
import { visualConcepts } from "../src/lib/analysis/visual-support";
import { comparisonText } from "../src/lib/analysis/guardrails";
it("does not assign a targeted outcome to every target mentioned in a product name", () => {
  expect(
    visualConcepts(
      comparisonText(
        "سيروم الرموش والحواجب للعناية بمظهر الحواجب مع ملاحظة زيادة كثافتها",
      ),
    ),
  ).toEqual(["eyebrow_density"]);
  expect(
    visualConcepts(comparisonText("Longer lashes and thicker brows")),
  ).toEqual(["eyebrow_density", "lash_length"]);
});
const theme = (quote: string, id = "t"): Theme => ({
  id,
  label: "Synthetic evidence",
  category: "outcome",
  scope: "product",
  count: 1,
  reviewIds: [id],
  quotes: [{ reviewId: id, quote }],
});
const check = (text: string, quote: string) =>
  validateClaims({ copy: text }, ["t"], [theme(quote)], "angle").map(
    (r) => r.code,
  );
it.each([
  ["مظهر حواجب أكثف", "حواجبي بقت أكثف"],
  ["مراجعات بتتكلم عن كثافة أوضح للحواجب", "لاحظت كثافة أكتر في الحواجب"],
  ["مظهر أكثف", "كثفت حواجبي"],
  ["عملاء لاحظوا مظهر حواجب أكثف", "حواجبي خفيفة أصلًا دلوقتي تقلت"],
  ["Customers reported fuller-looking brows.", "My eyebrows became thicker."],
  ["مراجعات عن رموش أطول", "رموشي طولت"],
])("accepts the same supported visual concept: %s", (text, quote) =>
  expect(check(text, quote)).toEqual([]),
);
it("rejects target crossover and unrelated appearance changes", () => {
  expect(check("رموش أطول", "حواجبي بقت أكثف")).toContain(
    "claim.target-unsupported",
  );
  expect(check("رموش أطول", "رموشي بقت أكثف")).toContain(
    "claim.visual-unsupported",
  );
  expect(check("مظهر أكثف", "الملمس ناعم")).toContain(
    "claim.visual-unsupported",
  );
});
it("requires outcome and timeframe in the same evidence and preserves qualification", () => {
  expect(check("هتشوفي حواجب أكثف خلال أسبوعين", "حواجبي بقت أكثف")).toContain(
    "claim.timeline-unsupported",
  );
  expect(
    check(
      "بعض العملاء لاحظوا كثافة أكبر بعد حوالي شهر",
      "حواجبي بقت أكثف بعد شهر",
    ),
  ).toEqual([]);
  const themes = [theme("حواجبي بقت أكثف"), theme("استخدمته بعد شهر", "other")];
  expect(
    validateClaims(
      { copy: "عملاء لاحظوا مظهر حواجب أكثف بعد شهر" },
      ["t", "other"],
      themes,
      "angle",
    ).map((r) => r.code),
  ).toContain("claim.timeline-unsupported");
});
it.each(["هيكثف حواجبك", "هتشوفي حواجبك أكثف", "يضمن حواجب أكثف"])(
  "rejects future certainty despite matching evidence: %s",
  (text) =>
    expect(check(text, "حواجبي بقت أكثف")).toContain(
      "claim.visual-future-promise",
    ),
);
it.each([
  "نتيجة",
  "فرق",
  "حسيت بفرق في الملمس",
  "ناعم ومريح وخفيف",
  "ملمس طري",
  "Smooth, soft and comfortable",
])(
  "does not equate ambiguous or sensory wording with a visual outcome: %s",
  (text) =>
    expect(check(text, "الملمس ناعم")).not.toContain(
      "claim.visual-unsupported",
    ),
);
