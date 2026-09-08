import type { StoredOutputLanguage as OutputLanguage } from "../language";
import type { Theme } from "./schema";
import { visualConcepts, supportsVisualConcepts } from "./visual-support";
import {
  creativeDevice,
  experientialTestimony,
  targetConcepts,
} from "./content-identity";
export { creativeDevice } from "./content-identity";

// Comparison only: never rewrite stored quotes or review text.
export function comparisonText(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (x) => String(x.charCodeAt(0) - 1632))
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .trim();
}
const patterns = {
  frequency:
    /every day|daily|each night|كل يوم|كل ليله|يوميا|اليومي|روتينها كل/,
  absolute:
    /\bguarantee(?:d)?\b|\balways\b|\beveryone\b|\bdefinitely\b|100\s*%|مضمون|اكيد|لكل الناس|للجميع|كل الاجسام|مستحيل|ابدا/,
  fit: /perfect fit|true to size|fits? (?:every|all)|مقاس مثالي|مقاس مظبوط|مقاس مضبوط|مناسب لكل|يناسب كل|مظبوط علي/,
  durability:
    /durab|lasts? (?:for )?years|wear out|long lasting|طويل الامد|متين|متانه|يعيش سنين|هيبوظ|يتلف|يتحمل الغسيل/,
  cooling: /cool(?:s|ing)?\b|تبريد|برود|ابرد|بالحر|بيبرد|يبرد|هتحري/,
  warmth: /warmth|keeps? warm|دافي|دفء|تدفئه/,
  regulation:
    /regulat.{0,15}temperatur|ينظم.{0,15}حراره|يحافظ.{0,15}درجه الحراره/,
  breathability: /breathab|ventilat|تهويه|يسمح.{0,12}الهوا|يسمح.{0,12}الهواء/,
  waterproof: /waterproof|مقاوم.{0,5}(?:الماء|الميه)/,
  shipping: /deliver|shipping|arriv|توصيل|شحن|هيوصل|يوصلك|هيجيلك/,
  medical:
    /\bcure|\btreat(?:s|ment|ing)?\b|therap|diagnos|clinically|علاج|يعالج|يشفي|شفاء|طبي مثبت|تشخيص/,
  visual:
    /visibl|noticeable (?:growth|difference|results)|see (?:the |a )?(?:difference|results)|looks? different|appearance|before and after|before after|نتيجه باين|نتائج ملحوظ|فرق (?:باين|واضح|ظاهر)|(?:هتشوفي|تشوفي|شوفت|شفت) (?:الفرق|النتيجه)|مظهر|قبل وبعد|قبل و بعد|(?:طول|كثاف|اطول|امتلاء).{0,15}(?:رموش|حواجب|اظافر)|(?:رموش|حواجب|اظافر).{0,15}(?:طول|كثاف|اطول|امتلاء)/,
  outcome:
    /result|grow|growth|longer|stronger|improv|فرق|نتيج|نتائج|طول|قوه|اقوي|تحسن|كثاف|تكثيف|كثيف|تساقط|تكسر/,
};
const attribution =
  /review|customer.{0,20}(?:said|reported|mentioned)|reported|one user|تقييم|مراجع|عميل|عملاء|تجرب|وصفت|ذكرت|ذكر |اشار|حكت|قالت|قال /;
const recommendation =
  /\buse (?:it )?(?:every|daily)|suitable for daily|will .{0,30}(?:every|daily)|هتدخل|استخدم.{0,20}(?:كل يوم|يوميا)|استخدمي|مناسب.{0,20}(?:اليومي|كل يوم)|خليه.{0,20}كل يوم/;
const visualProduction =
  /before and after|before after|قبل وبعد|قبل و بعد|split screen|تقسيم الشاشه|مقارنه.{0,20}(?:صور|رموش|بشره)|اليوم\s*1|day\s*1/;
const timePattern =
  /\b(?:\d+|one|two|three|four|five|six|seven|ten|eleven|fourteen)\s*(?:days?|weeks?|months?|years?)\b|(?:\d+)\s*(?:يوم|ايام|اسبوع|اسابيع|شهر|شهور|سنه|سنين)|اسبوعين|شهرين|يومين|(?:خلال|بعد|في)(?: حوالي)? (?:اسبوع|شهر)|كام يوم|بضعه ايام|ايام قليله|بسرعه|سريعا|quick(?:ly)?|rapid(?:ly)?/g;
function times(text: string) {
  return (comparisonText(text).match(timePattern) || []).map((x) =>
    x
      .replace(/\bone\b/g, "1")
      .replace(/\btwo\b/g, "2")
      .replace(/\bthree\b/g, "3")
      .replace(/\bfour\b/g, "4")
      .replace(/\bfive\b/g, "5")
      .replace(/\bsix\b/g, "6")
      .replace(/\bseven\b/g, "7")
      .replace(/\bten\b/g, "10")
      .replace(/\beleven\b/g, "11")
      .replace(/\bfourteen\b/g, "14")
      .replace(/اسبوعين/g, "2 week")
      .replace(/شهرين/g, "2 month")
      .replace(/يومين/g, "2 day")
      .replace(/(?:خلال|بعد|في)(?: حوالي)? اسبوع/g, "1 week")
      .replace(/(?:خلال|بعد|في)(?: حوالي)? شهر/g, "1 month")
      .replace(/ايام|يوم|days?/g, "day")
      .replace(/اسابيع|اسبوع|weeks?/g, "week")
      .replace(/شهور|شهر|months?/g, "month")
      .replace(/سنين|سنه|years?/g, "year")
      .replace(/\s+/g, " "),
  );
}
export type Grounded = { themeIds: string[] };
export type AngleCandidate = Grounded & {
  name: string;
  type: string;
  persona: string;
  insight: string;
  hook: string;
  alternativeHooks: string[];
  copy: string;
  ugc: string;
  firstThreeSeconds: string;
  cta: string;
};
export type InsightCandidate = Grounded & {
  category: string;
  title: string;
  description: string;
};
export type Rejection = { code: string; field: string };
export function localized(
  fields: Record<string, string>,
  language: OutputLanguage,
): Rejection[] {
  if (language === "en") return [];
  const failures: Rejection[] = [];
  for (const [field, text] of Object.entries(fields)) {
    const ar = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const foreign = text.match(/\b[A-Za-z][A-Za-z-]*\b/g) || [];
    // An isolated brand in Arabic prose is fine; a whole untranslated field is not.
    if (
      text.trim() &&
      ((!ar && foreign.length > 0) ||
        (foreign.length >= 5 && foreign.join("").length > ar))
    )
      failures.push({ code: "localization.incomplete", field });
  }
  if (language === "ar-EG") {
    const text = comparisonText(Object.values(fields).join(" "));
    const formal =
      text.match(
        /(?:^| )(?:سوف|الذي|التي|هذه|ذلك|حيث|لذا)(?= |$)|تمنحك|يمكنك|تستطيعين|يعد هذا|لديك|تمنحين|اختاري ما يناسبك/g,
      ) || [];
    if (formal.length >= 5)
      failures.push({ code: "localization.msa-heavy", field: "style" });
  }
  return failures;
}
export function validateClaims(
  fields: Record<string, string>,
  themeIds: string[],
  themes: Theme[],
  mode: "angle" | "insight" | "followup",
): Rejection[] {
  const errors: Rejection[] = [];
  const reject = (code: string, field: string) => errors.push({ code, field });
  const selected = themes.filter((t) => themeIds.includes(t.id));
  if (!themeIds.length || new Set(themeIds).size !== selected.length)
    reject("evidence.unknown", "themeIds");
  const product = selected.filter((t) => t.scope === "product");
  const evidenceTargets = new Set(
    targetConcepts(
      comparisonText(
        product
          .map((t) => t.label + " " + t.quotes.map((q) => q.quote).join(" "))
          .join(" "),
      ),
    ),
  );
  if (
    mode !== "insight" &&
    (!product.length || product.length !== selected.length)
  )
    reject("scope.product-required", "themeIds");
  const quotes = product
    .filter(
      (t) =>
        ![
          "persona",
          "feature_request",
          "objection",
          "complaint",
          "pain",
        ].includes(t.category),
    )
    .flatMap((t) =>
      t.quotes.map((q) => ({
        text: comparisonText(q.quote),
        category: t.category,
      })),
    );
  for (const [field, value] of Object.entries(fields)) {
    const text = comparisonText(value),
      attributed = attribution.test(text);
    // Only exempt an exact source quotation visibly labelled as customer evidence
    // in this field; a model's unsupported "this is a quote" assertion is insufficient.
    const labelledQuote =
      /customer quote|from a review|review quote|راي عميله|تجربه عميله|من مراجعه|نص المراجعه/.test(
        text,
      );
    const testimonyText = labelledQuote
      ? value.replace(/[«“"]([^»”"\n]+)[»”"]/g, (span, quote: string) =>
          product.some((t) => t.quotes.some((q) => q.quote.includes(quote)))
            ? ""
            : span,
        )
      : value;
    if (
      mode !== "insight" &&
      experientialTestimony(comparisonText(testimonyText))
    )
      reject("claim.creator-provenance", field);
    for (const target of targetConcepts(text)) {
      // Hands/eyes in filming directions may be scene props rather than use targets.
      const scene = ["ugc", "firstThreeSeconds"].includes(field);
      const application =
        /apply|application|use.{0,15}(?:on|for)|تطبيق|وضع.{0,20}علي|حط.{0,20}علي|استخدام.{0,20}(?:علي|لل)/.test(
          text,
        );
      const incidental =
        scene && ["hands", "eyes", "feet"].includes(target) && !application;
      if (!incidental && !evidenceTargets.has(target))
        reject("claim.target-unsupported", field);
    }
    if (patterns.absolute.test(text)) reject("claim.absolute", field);
    if (
      patterns.frequency.test(text) &&
      (!attributed ||
        recommendation.test(text) ||
        !quotes.some((q) => patterns.frequency.test(q.text)))
    )
      reject("claim.frequency-recommendation", field);
    if (patterns.medical.test(text)) reject("claim.medical", field);
    const scopedDescription =
      mode === "insight" &&
      attribution.test(comparisonText(Object.values(fields).join(" "))) &&
      selected.some((t) => t.scope === "shipping" || t.scope === "seller") &&
      !/will |guarantee|هيوصل|يوصلك|هيجيلك/.test(text);
    if (patterns.shipping.test(text) && !scopedDescription)
      reject("scope.shipping-promise", field);
    if (
      mode === "insight" &&
      !product.length &&
      (!scopedDescription || !patterns.shipping.test(text))
    )
      reject("scope.non-product", field);
    for (const family of [
      "fit",
      "durability",
      "cooling",
      "warmth",
      "regulation",
      "breathability",
      "waterproof",
    ] as const) {
      if (
        patterns[family].test(text) &&
        !quotes.some(
          (q) =>
            patterns[family].test(q.text) &&
            !/does not|doesn t|is not|isn t|not cool|no cooling|مش بيبرد|لا يبرد/.test(
              q.text,
            ),
        )
      )
        reject(`claim.${family}-unsupported`, field);
      if (
        (family === "fit" || family === "durability") &&
        patterns[family].test(text) &&
        !attributed
      )
        reject(`claim.${family}-generalized`, field);
    }
    const visual = visualConcepts(text);
    const visualTriggered = visual.length > 0 || patterns.visual.test(text);
    if (
      visualTriggered &&
      !quotes.some((q) =>
        visual.length
          ? supportsVisualConcepts(visual, visualConcepts(q.text))
          : visualConcepts(q.text).length > 0 || patterns.visual.test(q.text),
      )
    )
      reject("claim.visual-unsupported", field);
    if (
      visualTriggered &&
      /\bwill\b|\byou ll\b|هيكثف|هتكثف|هيطول|هتطول|هتشوفي|هتشوف |يضمن|يضمنلك|سوف/.test(
        text,
      )
    )
      reject("claim.visual-future-promise", field);
    const timeframe = times(value);
    if (timeframe.length && (patterns.outcome.test(text) || visualTriggered)) {
      // SAME exact quote must contain the outcome and its timeframe; no cross-review joins.
      if (
        !attributed ||
        timeframe.some(
          (time) =>
            !quotes.some(
              (q) =>
                (visual.length
                  ? supportsVisualConcepts(visual, visualConcepts(q.text))
                  : patterns.outcome.test(q.text)) &&
                times(q.text).includes(time),
            ),
        )
      )
        reject("claim.timeline-unsupported", field);
    }
    // Textual testimonials cannot authenticate synthetic visual progress images.
    if (
      (field === "ugc" ||
        field === "firstThreeSeconds" ||
        mode === "followup") &&
      visualProduction.test(text) &&
      patterns.outcome.test(text)
    )
      reject("claim.visual-proof-invented", field);
    if (/\d+\s*%|percent|بالمئه|في الميه/.test(text))
      reject("claim.percentage", field);
    if (
      /\d+\s*(?:customers|users|people|عميل|مستخدم|شخص)|thousands of|millions of|الاف العملاء/.test(
        text,
      )
    )
      reject("claim.customer-count", field);
  }
  return errors;
}
export function angleFields(a: AngleCandidate): Record<string, string> {
  return {
    name: a.name,
    type: a.type,
    persona: a.persona,
    insight: a.insight,
    hook: a.hook,
    alternativeHooks: a.alternativeHooks.join("\n"),
    copy: a.copy,
    ugc: a.ugc,
    firstThreeSeconds: a.firstThreeSeconds,
    cta: a.cta,
  };
}
const concepts: Record<string, RegExp> = {
  texture_oil:
    /non oily|non greasy|greas|oil free|اثر زيتي|ملمس زيتي|مش بيدهن|بدون زيت|بلا زيت/,
  irritation: /irritat|gentle.{0,15}eye|لطيف.{0,15}عين|تهيج|حساسيه/,
  application:
    /easy.{0,20}(?:apply|application)|سهول.{0,15}(?:تطبيق|استخدام)|سهل.{0,15}(?:تطبيق|استخدام)/,
  value: /value|affordable|قيمه.{0,15}سعر|سعر مناسب/,
  quality: /quality|stitch|خياطه|تقفيل|جوده/,

  repurchase:
    /buy.{0,15}(?:again|another|second)|repurchase|repeat purchase|second (?:one|bottle)|اعاده (?:الشراء|الطلب)|شراء.{0,12}(?:تاني|ثاني|اضافي)|قطعه تانيه|واحده كمان|عبوه.{0,12}(?:ثاني|تاني)|طلب.{0,12}(?:تاني|ثاني)|طلب جديد/,
  gift: /gift|birthday|هديه|اهدا|عيد ميلاد/,
  design: /pattern|design|cute|تصميم|رسوم|رسومات|رسمة|رسمه|شكله لطيف/,
  cooling: patterns.cooling,
  softness: /soft|silky|ناعم|نعوم|حريري/,
  comfort: /comfort|lounge|roomy|oversiz|مريح|راحه|وسع|واسع|حريه|كنبه|بيجامه/,
  visual: patterns.visual,
};
export function concept(a: AngleCandidate, themes: Theme[]) {
  const headline = comparisonText(a.name + " " + a.hook + " " + a.copy);
  const selected = themes.filter((t) => a.themeIds.includes(t.id));
  const appearance = visualConcepts(headline).filter(
    (key) => key !== "density",
  );
  if (appearance.length) return "appearance:" + appearance.sort().join("+");
  // A generic headline can hide a specific outcome. Prefer the selected primary
  // outcome/benefit over generic product-name or emotion themes in that case.
  const primaryOutcome = selected.find(
    (t) =>
      ["outcome", "benefit"].includes(t.category) &&
      visualConcepts(comparisonText(t.label)).some((key) => key !== "density"),
  );
  if (primaryOutcome)
    return (
      "appearance:" +
      visualConcepts(comparisonText(primaryOutcome.label))
        .filter((key) => key !== "density")
        .sort()
        .join("+")
    );
  for (const [key, re] of Object.entries(concepts))
    if (re.test(headline)) return key;
  const primary = themes
    .filter((t) => a.themeIds.includes(t.id))
    .sort((a, b) => b.count - a.count)[0];
  return primary
    ? [primary.scope, primary.category, comparisonText(primary.label)].join(":")
    : comparisonText(a.name);
}
function similarity(a: string, b: string) {
  const tokens = (s: string) =>
    new Set(
      comparisonText(s)
        .split(" ")
        .filter((x) => x.length > 2),
    );
  const x = tokens(a),
    y = tokens(b);
  return (
    [...x].filter((t) => y.has(t)).length /
    Math.max(1, new Set([...x, ...y]).size)
  );
}
export function duplicate(
  a: AngleCandidate,
  b: AngleCandidate,
  themes: Theme[],
) {
  const overlap =
    a.themeIds.filter((id) => b.themeIds.includes(id)).length /
    Math.max(1, Math.min(a.themeIds.length, b.themeIds.length));
  const same = concept(a, themes) === concept(b, themes);
  const wording = similarity(a.hook + " " + a.copy, b.hook + " " + b.copy);
  const execution = similarity(
    a.ugc + " " + a.firstThreeSeconds,
    b.ugc + " " + b.firstThreeSeconds,
  );
  const intent = similarity(a.type, b.type);
  // Category labels or rewording cannot make the same core motivation distinct.
  return (
    (same &&
      (Object.keys(concepts).includes(concept(a, themes)) ||
        concept(a, themes).startsWith("appearance:") ||
        overlap >= 0.5 ||
        execution > 0.4)) ||
    wording > 0.68 ||
    (overlap >= 0.75 && intent >= 0.8 && wording > 0.35) ||
    execution > 0.72
  );
}
export function validateAngle(
  a: AngleCandidate,
  themes: Theme[],
  lang: OutputLanguage,
  accepted: AngleCandidate[] = [],
): Rejection[] {
  return [
    ...validateClaims(angleFields(a), a.themeIds, themes, "angle"),
    ...localized(angleFields(a), lang),
    ...(accepted.some((b) => duplicate(a, b, themes))
      ? [{ code: "angle.duplicate-concept", field: "centralClaim" }]
      : []),
    ...(accepted.some((b) => {
      const device = creativeDevice(
        comparisonText(a.ugc + " " + a.firstThreeSeconds),
      );
      return (
        device !== "unknown" &&
        device ===
          creativeDevice(comparisonText(b.ugc + " " + b.firstThreeSeconds))
      );
    })
      ? [{ code: "angle.duplicate-execution", field: "ugc" }]
      : []),
  ];
}
export function validateInsight(
  i: InsightCandidate,
  themes: Theme[],
  lang: OutputLanguage,
): Rejection[] {
  const fields = { title: i.title, description: i.description };
  return [
    ...validateClaims(fields, i.themeIds, themes, "insight"),
    ...localized(fields, lang),
  ];
}
