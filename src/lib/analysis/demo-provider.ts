import type { ModelProvider } from "./provider";
import { factCatalog } from "./aggregate";
import type { Extraction, Theme } from "./schema";
import { isFixture } from "../fixtures";
// A deliberately narrow deterministic provider for the bundled SYNTHETIC bottle fixtures only.
const rules: {
  test: RegExp;
  category: Extraction["facts"][number]["category"];
  en: string;
  ar: string;
  scope?: Extraction["facts"][number]["scope"];
}[] = [
  {
    test: /does not leak|مش بتسرب|ما تسرب|الغطا المحكم|الغطا محكم|secure lid/i,
    category: "benefit",
    en: "A leak-free daily carry",
    ar: "غطاء محكم للاستخدام اليومي",
  },
  {
    test: /stays warm|بتفضل سخنة/i,
    category: "benefit",
    en: "Warm coffee through the workday",
    ar: "قهوة دافئة خلال يوم العمل",
  },
  {
    test: /stays cold|بتفضل باردة/i,
    category: "benefit",
    en: "Cold water for active days",
    ar: "مياه باردة أثناء النشاط",
  },
  {
    test: /clean|تنظيف|للتنظيف/i,
    category: "pain",
    en: "Cleaning needs to be easier",
    ar: "التنظيف يحتاج إلى تحسين",
  },
  {
    test: /price|السعر/i,
    category: "objection",
    en: "Upfront price hesitation",
    ar: "التردد بسبب السعر",
  },
  {
    test: /commute|office|work bag|الشغل|المواصلات|المشاوير/i,
    category: "use_case",
    en: "The everyday commute",
    ar: "المشاوير اليومية",
  },
  {
    test: /heavy|تقيلة/i,
    category: "pain",
    en: "Weight in a small bag",
    ar: "الوزن داخل الشنطة",
  },
  {
    test: /cup holder|لحامل الأكواب/i,
    category: "attribute",
    en: "Fits a car cup holder",
    ar: "مناسبة لحامل الأكواب",
  },
  {
    test: /love|relief|مبسوطة|ارتحت|مرتاح/i,
    category: "emotion",
    en: "Peace of mind on the move",
    ar: "راحة البال أثناء التنقل",
  },
  {
    test: /late|اتأخر/i,
    category: "complaint",
    en: "Delayed delivery",
    ar: "تأخر التوصيل",
    scope: "shipping",
  },
  {
    test: /support|خدمة العملاء/i,
    category: "benefit",
    en: "Helpful replacement support",
    ar: "الدعم وتوفير بديل",
    scope: "support",
  },
  {
    test: /wish|Please|ياريت|نفسي|محتاجين/i,
    category: "feature_request",
    en: "A more practical lid and opening",
    ar: "غطاء وفتحة أكثر عملية",
  },
  {
    test: /old travel mug|بالمج القديم/i,
    category: "comparison",
    en: "Compared with a previous travel mug",
    ar: "مقارنة بالكوب السابق",
  },
  {
    test: /did not expect|مما توقعت/i,
    category: "unexpected",
    en: "Unexpected travel usefulness",
    ar: "فائدة غير متوقعة في السفر",
  },
  {
    test: /plastic|بلاستيك/i,
    category: "complaint",
    en: "Excess plastic packaging",
    ar: "بلاستيك زائد في التغليف",
    scope: "packaging",
  },
];
export const demoProvider: ModelProvider = {
  async extract(reviews) {
    if (reviews.some((r) => !isFixture(r.text)))
      throw new Error(
        "Demo analysis supports only bundled synthetic fixtures. Configure OpenAI and Supabase to analyze your own reviews.",
      );
    return {
      records: reviews.map((r) => ({
        reviewId: r.id,
        sentiment: /difficult|heavy|late|صعبة|تقيلة|اتأخر/.test(r.text)
          ? ("mixed" as const)
          : ("positive" as const),
        facts: rules
          .filter((rule) => rule.test.test(r.text))
          .map((rule) => ({
            category: rule.category,
            label: r.language === "ar" ? rule.ar : rule.en,
            quote: r.masked,
            scope: rule.scope || "product",
          })),
      })),
    };
  },
  async group(records, language) {
    const groups = new Map<string, string[]>();
    factCatalog(records).forEach((f) => {
      const rule = rules.find((r) => r.en === f.label || r.ar === f.label);
      const label = rule ? (language === "en" ? rule.en : rule.ar) : f.label;
      groups.set(label, [...(groups.get(label) || []), f.key]);
    });
    return {
      groups: [...groups].map(([label, factKeys]) => ({ label, factKeys })),
    };
  },
  async intelligence(themes, language) {
    const categoryMap: Record<
      string,
      | "benefit"
      | "pain"
      | "objection"
      | "use_case"
      | "persona"
      | "emotion"
      | "comparison"
      | "unexpected"
      | "product_opportunity"
      | "purchase_reason"
    > = {
      benefit: "benefit",
      pain: "pain",
      objection: "objection",
      use_case: "use_case",
      emotion: "emotion",
      comparison: "comparison",
      unexpected: "unexpected",
      feature_request: "product_opportunity",
      attribute: "purchase_reason",
    };
    const insights = themes
      .filter((t) => categoryMap[t.category])
      .map((t) => ({
        category: categoryMap[t.category],
        title: t.label,
        description:
          language === "en"
            ? `Synthetic fixture finding: ${t.label.toLowerCase()}. Inspect the original reviews before using this message.`
            : `نتيجة من بيانات تجريبية: ${t.label}. راجع النصوص الأصلية قبل استخدام الرسالة.`,
        themeIds: [t.id],
      }));
    const commute = themes.find((t) => t.category === "use_case");
    if (commute)
      insights.push({
        category: "persona",
        title:
          language === "en"
            ? "The daily commuter · hypothesis"
            : "الشخص كثير التنقل · فرضية",
        description:
          language === "en"
            ? "A use-case hypothesis based on commuting mentions, not a demographic profile."
            : "فرضية مبنية على ذكر التنقل اليومي وليست وصفاً ديموغرافياً مؤكداً.",
        themeIds: [commute.id],
      });
    return { insights };
  },
  async angles(themes, language) {
    return {
      angles: themes
        .filter(
          (t) =>
            t.scope === "product" &&
            [
              "benefit",
              "use_case",
              "attribute",
              "unexpected",
              "emotion",
            ].includes(t.category),
        )
        .slice(0, 10)
        .map((t) => {
          const ar = language !== "en";
          const hook = ar
            ? language === "ar-EG"
              ? `يومك أسهل مع ${t.label}`
              : language === "ar-SA"
                ? `خل يومك أسهل مع ${t.label}`
                : `${t.label} ليوم أكثر راحة`
            : `Make room for ${t.label.toLowerCase()}`;
          return {
            name: t.label,
            type: ar ? "فائدة مدعومة" : "Evidence-led benefit",
            persona: ar ? "مستخدم يومي · فرضية" : "Everyday user · hypothesis",
            insight: t.label,
            themeIds: [t.id],
            hook,
            alternativeHooks: [
              ar
                ? `تفاصيل صغيرة تفرق في يومك: ${t.label}`
                : `A small detail for your day: ${t.label}`,
            ],
            copy: ar
              ? `${hook}. اكتشف التفاصيل التي ذكرها مستخدمو المنتج في هذه البيانات التجريبية.`
              : `${hook}. Explore the detail customers mention in these synthetic reviews.`,
            ugc: ar
              ? "فكرة تجريبية: اعرض المنتج أثناء الاستخدام اليومي مع توضيح الفائدة المذكورة دون ادعاء تجربة شخصية."
              : "Synthetic concept: show the bottle in an everyday setting and demonstrate the cited feature without inventing a personal testimonial.",
            firstThreeSeconds: ar
              ? `لقطة قريبة للمنتج مع عنوان: ${t.label}`
              : `Close-up of the bottle with the caption: ${t.label}`,
            cta: ar ? "شوف تفاصيل المنتج" : "Explore the product",
          };
        }),
    };
  },
  async followup(angle, _reviews, kind, language) {
    return {
      content:
        kind === "hooks"
          ? [angle.hook, ...angle.alternativeHooks].join("\n")
          : language === "en"
            ? `Synthetic script concept\n0–3s: ${angle.firstThreeSeconds}\n3–15s: ${angle.ugc}\n15–25s: ${angle.copy}\n25–30s: ${angle.cta}`
            : `نص تجريبي\n٠–٣ ث: ${angle.firstThreeSeconds}\n٣–١٥ ث: ${angle.ugc}\n١٥–٢٥ ث: ${angle.copy}\n٢٥–٣٠ ث: ${angle.cta}`,
      reviewIds: angle.reviewIds,
    };
  },
  async translate() {
    throw new Error(
      "Review translation requires a configured OpenAI account. Original synthetic quotes remain available.",
    );
  },
};
