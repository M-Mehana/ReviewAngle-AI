import { expect, it } from "vitest";
import { presentsCustomerProof } from "../src/lib/analysis/content-identity";
import {
  comparisonText,
  type AngleCandidate,
} from "../src/lib/analysis/guardrails";
import {
  creativeSignature,
  planPortfolio,
  planSavedPortfolio,
  validateAssignedSlot,
  validatePortfolioSet,
  type PortfolioSlot,
} from "../src/lib/analysis/portfolio";
import type { Theme } from "../src/lib/analysis/schema";
const t = (id: string, label: string, count = 1): Theme => ({
  id,
  label,
  count,
  category: "benefit",
  scope: "product",
  reviewIds: Array.from({ length: count }, (_, i) => id + i),
  quotes: [{ reviewId: id + 0, quote: label }],
});
const themes = [
  t("length", "طول الرموش", 3),
  t("oil", "ملمس غير زيتي", 2),
  t("apply", "سهولة التطبيق", 4),
  t("gentle", "لطيف على العين", 1),
  t("value", "سعر مناسب", 5),
];
const a = (id: string, ugc: string): AngleCandidate => ({
  name: themes.find((t) => t.id === id)!.label,
  hook: themes.find((t) => t.id === id)!.label,
  copy: themes.find((t) => t.id === id)!.label,
  type: "فائدة",
  persona: "متسوقون",
  insight: "أدلة داخلية من المراجعات",
  themeIds: [id],
  alternativeHooks: [],
  ugc,
  firstThreeSeconds: ugc,
  cta: "شاهد التفاصيل",
});
it.each([
  "قالت عميلة",
  "قال عميل",
  "المراجعات بتقول",
  "شرح مراجعة على الشاشة",
  "قراءة آراء العملاء",
  "عميلة بتقول",
  "الناس بتقول",
  "تعليق عميلة",
  "واحدة جربته وقالت",
  "تظهر نجوم التقييم على الشاشة",
  "presenter reads a review",
  "review screenshot overlay",
])(
  "recognizes actual testimony regardless of the requested device: %s",
  (scene) => {
    expect(
      creativeSignature(a("oil", scene), {
        creativeDevice: "objection_answer",
        evidenceMode: "implicit_evidence",
      }),
    ).toBe("social_proof");
  },
);
it.each([
  "تجربة لون جديد",
  "لقطة قريبة للعبوة",
  "توضيح عملي بدون عرض اقتباسات",
])(
  "does not mistake ordinary experience/product scenes for testimony: %s",
  (text) => expect(presentsCustomerProof(comparisonText(text))).toBe(false),
);
it("reserves only the strongest social proof and assigns fixed non-proof repairs", () => {
  const saved = [
    a("length", "شرح مراجعة على الشاشة"),
    a("oil", "مقدمة تقرأ آراء العملاء"),
    a("value", "قال عميل على الشاشة"),
    a("apply", "روتين تطبيق"),
  ];
  const plan = planSavedPortfolio(saved, themes);
  expect(
    plan
      .filter((p) => p.slot.evidenceMode === "explicit_social_proof")
      .map((p) => p.slot.primaryThemeId),
  ).toEqual(["value"]);
  expect(plan.filter((p) => p.needsExecutionRepair)).toHaveLength(2);
  expect(
    plan
      .filter((p) => p.needsExecutionRepair)
      .every((p) => p.slot.creativeDevice !== "social_proof"),
  ).toBe(true);
  expect(new Set(plan.map((p) => p.slot.motivation)).size).toBe(4);
  expect(saved[0].ugc).toBe("شرح مراجعة على الشاشة");
});
it("accepts a healthy five-family portfolio grounded in source reviews", () => {
  const set = [
    a("oil", "توضيح عملي للمنتج"),
    a("apply", "روتين تطبيق"),
    a("gentle", "سؤال وإجابة عن اعتراض"),
    a("value", "قال عميل على الشاشة"),
    a("length", "لقطة قريبة للعبوة"),
  ];
  expect(validatePortfolioSet(set, themes)).toEqual([]);
  expect(set.map((x) => creativeSignature(x))).toEqual([
    "product_demo",
    "routine",
    "objection_answer",
    "social_proof",
    "close_up",
  ]);
});
it("guards every new creative field but leaves internal rationale and original evidence untouched", () => {
  const item = a("oil", "توضيح عملي للمنتج");
  const before = JSON.stringify(themes);
  const slot: PortfolioSlot = {
    motivation: planSavedPortfolio([item], themes)[0].slot.motivation,
    primaryThemeId: "oil",
    themeIds: ["oil"],
    creativeDevice: "product_demo",
    evidenceMode: "implicit_evidence",
  };
  expect(validateAssignedSlot(item, slot, themes)).toEqual([]);
  for (const field of ["hook", "copy", "ugc", "firstThreeSeconds", "cta"]) {
    expect(
      validateAssignedSlot(
        { ...item, [field]: "قالت عميلة إن الملمس مناسب" },
        slot,
        themes,
      ).some((r) => r.code === "portfolio.explicit-proof-forbidden"),
    ).toBe(true);
  }
  expect(
    validateAssignedSlot(
      { ...item, ugc: "لقطة قريبة للعبوة", firstThreeSeconds: "لقطة قريبة" },
      slot,
      themes,
    ).some((r) => r.code === "portfolio.device-mismatch"),
  ).toBe(true);
  expect(JSON.stringify(themes)).toBe(before);
});
it("plans distinct fixed slots before new prose without paid embeddings", () => {
  const plan = planPortfolio(themes);
  expect(plan).toEqual(planPortfolio(themes));
  expect(plan.length).toBe(5);
  expect(new Set(plan.map((s) => s.motivation)).size).toBe(5);
  expect(new Set(plan.map((s) => s.creativeDevice)).size).toBe(5);
  expect(
    plan.every(
      (s) =>
        s.evidenceMode === "implicit_evidence" &&
        s.themeIds.includes(s.primaryThemeId),
    ),
  ).toBe(true);
});
it.each([
  ["تصوير مقرّب وثابت للعبوة ثم لقطة ماكرو", "close_up"],
  [
    "إبراز خاصية المنتج: تظهر العبوة على خلفية نظيفة مع الخاصية المكتوبة",
    "product_feature",
  ],
])(
  "recognizes Arabic device descriptions without trusting enum labels: %s",
  (scene, device) => {
    expect(creativeSignature(a("oil", scene))).toBe(device);
    expect(creativeSignature(a("oil", scene + " ثم تعرض مراجعة عميلة"))).toBe(
      "social_proof",
    );
  },
);
