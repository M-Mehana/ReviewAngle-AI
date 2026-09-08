import { expect, it } from "vitest";
import {
  concept,
  duplicate,
  validateAngle,
  comparisonText,
} from "../src/lib/analysis/guardrails";
import { creativeDevice } from "../src/lib/analysis/content-identity";
import type { Theme } from "../src/lib/analysis/schema";
const theme = (id: string, label: string): Theme => ({
  id,
  label,
  category: "benefit",
  scope: "product",
  count: 1,
  reviewIds: [id],
  quotes: [{ reviewId: id, quote: label }],
});
const themes = [
  theme("length-a", "رموش أطول"),
  theme("length-b", "زيادة طول الرموش السفلية"),
  theme("texture", "ملمس غير زيتي"),
  theme("gentle", "لطيف على العين"),
  theme("value", "سعر مناسب"),
  theme("quality", "جودة التصنيع"),
  theme("application", "سهولة التطبيق"),
];
const angle = (id: string, name: string, ugc: string) => ({
  name,
  hook: name,
  copy: name,
  insight: name,
  type: "فائدة",
  persona: "متسوقون",
  themeIds: [id],
  ugc,
  firstThreeSeconds: ugc,
  alternativeHooks: [],
  cta: "شاهد التفاصيل",
});
const diversity = (
  a: ReturnType<typeof angle>,
  accepted: ReturnType<typeof angle>[],
) =>
  validateAngle(a, themes, "ar", accepted).filter((r) =>
    r.code.startsWith("angle.duplicate"),
  );
it.each([
  "عرض اقتباس من عميل على ورقة شفافة بجوار العبوة",
  "تحريك كلمات الاقتباس على الشاشة مع إظهار المنتج",
  "لقطة للفرشاة مع إظهار الاقتباسين في الخلفية",
  "customer quotation beside a mirror",
])("groups quote-led prop variants into a single family: %s", (scene) =>
  expect(creativeDevice(comparisonText(scene))).toBe("review-card"),
);
it("detects materially equivalent overhead garment displays", () => {
  const a = angle("texture", "ملمس غير زيتي", "عرض المنتج من فوق على منضدة");
  const b = angle(
    "quality",
    "جودة التصنيع",
    "تصوير من أعلى للقطعة مفرودة وتحريكها بهدوء",
  );
  expect(diversity(b, [a]).map((r) => r.code)).toContain(
    "angle.duplicate-execution",
  );
});
it.each([
  "رموش أطول",
  "طول ملحوظ للرموش",
  "ركزي على طول الرموش",
  "زيادة طول الرموش السفلية",
])("deduplicates supported lash-length motivations: %s", (name) => {
  const a = angle("length-a", "رموش أطول", "رسم توضيحي");
  const b = angle("length-b", name, "متحدث أمام الكاميرا");
  expect(concept(a, themes)).toBe(concept(b, themes));
  expect(duplicate(a, b, themes)).toBe(true);
});
it("keeps one social-proof slot and rejects a five-of-six quote concentration", () => {
  const names = [
    "رموش أطول",
    "ملمس غير زيتي",
    "لطيف على العين",
    "سعر مناسب",
    "جودة التصنيع",
  ];
  const ids = ["length-a", "texture", "gentle", "value", "quality"];
  const candidates = names.map((n, i) =>
    angle(ids[i], n, "إظهار اقتباس من مراجعة بجوار المنتج"),
  );
  expect(diversity(candidates[0], [])).toEqual([]);
  expect(
    candidates
      .slice(1)
      .every((a) =>
        diversity(a, [candidates[0]]).some(
          (r) => r.code === "angle.duplicate-execution",
        ),
      ),
  ).toBe(true);
});
it("accepts a healthy set with independently distinct motivations and devices", () => {
  const set = [
    angle("length-a", "رموش أطول", "إظهار اقتباس من مراجعة"),
    angle("texture", "ملمس غير زيتي", "لقطة قريبة للمنتج"),
    angle("gentle", "لطيف على العين", "سؤال وإجابة عن العبوة"),
    angle("value", "سعر مناسب", "مقارنة خيارات"),
    angle("quality", "جودة التصنيع", "رسم توضيحي"),
    angle("application", "سهولة التطبيق", "خطوات استخدام"),
  ];
  set.forEach((a, i) => expect(diversity(a, set.slice(0, i))).toEqual([]));
});
it("ignores explicit absence of quotes without ignoring a real quote scene", () => {
  expect(creativeDevice(comparisonText("رسم توضيحي بدون عرض اقتباسات"))).toBe(
    "educational",
  );
  expect(
    creativeDevice(
      comparisonText("لقطة من فوق مع عرض عبارة المراجعة على الشاشة"),
    ),
  ).toBe("review-card");
});
