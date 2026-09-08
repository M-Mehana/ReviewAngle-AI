import type { Theme } from "./schema";
import {
  concept,
  comparisonText,
  type AngleCandidate,
  type Rejection,
} from "./guardrails";
import { creativeDevice, presentsCustomerProof } from "./content-identity";
export const portfolioDevices = [
  "problem_solution",
  "product_demo",
  "routine",
  "close_up",
  "lifestyle",
  "comparison",
  "objection_answer",
  "educational",
  "text_led",
  "pov",
  "social_proof",
  "product_feature",
  "talking_head",
] as const;
export type PortfolioDevice = (typeof portfolioDevices)[number];
export type EvidenceMode = "implicit_evidence" | "explicit_social_proof";
export type PortfolioSlot = {
  motivation: string;
  primaryThemeId: string;
  themeIds: string[];
  creativeDevice: PortfolioDevice;
  evidenceMode: EvidenceMode;
};
const execution = (a: AngleCandidate) =>
  comparisonText(a.ugc + " " + a.firstThreeSeconds);
// Actual presentation wins over any enum supplied by a model/caller.
export function creativeSignature(
  a: AngleCandidate,
  _declared?: Partial<PortfolioSlot>,
): PortfolioDevice | "unknown" {
  const text = execution(a);
  if (presentsCustomerProof(text)) return "social_proof";
  if (
    /(?:اجابه|رد).{0,25}(?:اعتراض|سؤال)|(?:سؤال|اعتراض).{0,35}(?:اجابه|رد)|objection|question.{0,30}answer/.test(
      text,
    )
  )
    return "objection_answer";
  if (/problem.solution|مشكل[\u0600-\u06ff]*.{0,30}حل/.test(text))
    return "problem_solution";
  if (/روتين|routine|خطوات استخدام/.test(text)) return "routine";
  if (
    /توضيح عملي|عرض عملي|استعراض عملي|product demo|demonstrat|تطبيق/.test(text)
  )
    return "product_demo";
  if (/(?:تصوير|لقطه|لقطات).{0,8}(?:مقرب|مقربه)|لقطه ماكرو/.test(text))
    return "close_up";
  if (/ابراز خاصي(?:ه|ت)|خاصي(?:ه|ت) المنتج/.test(text))
    return "product_feature";
  if (/تبديل بين|اختيار بين|مقارنه/.test(text)) return "comparison";
  const map: Record<string, PortfolioDevice> = {
    "review-card": "social_proof",
    "routine-demo": "product_demo",
    "close-up": "close_up",
    mirror: "lifestyle",
    "before-after": "comparison",
    comparison: "comparison",
    pov: "pov",
    "text-led": "text_led",
    lifestyle: "lifestyle",
    "talking-head": "talking_head",
    "product-display": "product_feature",
    unboxing: "product_feature",
    "objection-answer": "objection_answer",
    educational: "educational",
  };
  return map[creativeDevice(text)] || "unknown";
}
function themeConcept(t: Theme) {
  const text = comparisonText(t.label);
  if (
    /اول شراء|اول مره.{0,20}شراء|شراء.{0,25}ندم|first.{0,20}purchase/.test(text)
  )
    return "purchase_confidence";
  const a = {
    name: t.label,
    hook: t.label,
    copy: t.label,
    themeIds: [t.id],
  } as AngleCandidate;
  return concept(a, [t]);
}
function primary(a: AngleCandidate, themes: Theme[]) {
  const selected = themes.filter((t) => a.themeIds.includes(t.id));
  const central = concept(a, themes);
  return selected.slice().sort((x, y) => {
    const rank = (t: Theme) =>
      themeConcept(t) === "purchase_confidence"
        ? 4
        : themeConcept(t) === central
          ? 3
          : [
                "outcome",
                "benefit",
                "objection",
                "use_case",
                "attribute",
              ].includes(t.category)
            ? 2
            : 1;
    return rank(y) - rank(x) || y.count - x.count || x.id.localeCompare(y.id);
  })[0];
}
export function motivation(a: AngleCandidate, themes: Theme[]) {
  const t = primary(a, themes);
  return t ? themeConcept(t) : concept(a, themes);
}
const support = (a: AngleCandidate, themes: Theme[]) =>
  new Set(
    themes.filter((t) => a.themeIds.includes(t.id)).flatMap((t) => t.reviewIds),
  ).size;
function allocate(m: string, used: Set<string>): PortfolioDevice {
  const preferred: PortfolioDevice[] = m.includes("texture")
    ? ["product_demo", "close_up"]
    : m.includes("appearance")
      ? ["close_up", "product_feature"]
      : m.includes("irritation")
        ? ["objection_answer", "educational"]
        : m.includes("application")
          ? ["routine", "product_demo"]
          : ["product_feature", "educational"];
  return (
    [
      ...preferred,
      ...portfolioDevices.filter((d) => d !== "social_proof"),
    ].find((d) => !used.has(d)) || "product_feature"
  );
}
export type PlannedCandidate = {
  candidate: AngleCandidate;
  slot: PortfolioSlot;
  needsExecutionRepair: boolean;
};
// Reserve existing valid execution families before assigning any repair slots.
// Evidence/motivation stay fixed; the prose model cannot choose a different slot.
export function planSavedPortfolio(
  saved: AngleCandidate[],
  themes: Theme[],
): PlannedCandidate[] {
  const sorted = saved
    .slice(0, 12)
    .sort((a, b) => support(b, themes) - support(a, themes));
  const occupied = new Set<string>();
  const planned = sorted.map((a) => {
    const family = creativeSignature(a);
    const duplicate = family !== "unknown" && occupied.has(family);
    if (!duplicate && family !== "unknown") occupied.add(family);
    const t = primary(a, themes);
    return {
      candidate: a,
      needsExecutionRepair: duplicate,
      slot: {
        motivation: motivation(a, themes),
        primaryThemeId: t?.id || "",
        themeIds: [...a.themeIds],
        creativeDevice: family === "unknown" ? "product_feature" : family,
        evidenceMode:
          family === "social_proof" && !duplicate
            ? "explicit_social_proof"
            : "implicit_evidence",
      } as PortfolioSlot,
    };
  });
  for (const p of planned)
    if (p.needsExecutionRepair) {
      p.slot.creativeDevice = allocate(p.slot.motivation, occupied);
      occupied.add(p.slot.creativeDevice);
    }
  return planned;
}
// New analyses plan only supported, distinct motivations; no arbitrary slot filling.
export function planPortfolio(themes: Theme[], limit = 6): PortfolioSlot[] {
  const slots: PortfolioSlot[] = [],
    used = new Set<string>(),
    motivations = new Set<string>();
  for (const t of themes
    .filter(
      (t) => t.scope === "product" && t.reviewIds.length && t.quotes.length,
    )
    .slice()
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))) {
    const m = themeConcept(t);
    if (motivations.has(m)) continue;
    const device = allocate(m, used);
    if (used.has(device)) break;
    slots.push({
      motivation: m,
      primaryThemeId: t.id,
      themeIds: [t.id],
      creativeDevice: device,
      evidenceMode: "implicit_evidence",
    });
    used.add(device);
    motivations.add(m);
    if (slots.length >= limit) break;
  }
  return slots;
}
export function validateAssignedSlot(
  a: AngleCandidate,
  slot: PortfolioSlot,
  themes: Theme[],
): Rejection[] {
  const reasons: Rejection[] = [];
  if (
    !a.themeIds.includes(slot.primaryThemeId) ||
    a.themeIds.some((id) => !slot.themeIds.includes(id))
  )
    reasons.push({ code: "portfolio.evidence-envelope", field: "themeIds" });
  if (motivation(a, themes) !== slot.motivation)
    reasons.push({ code: "portfolio.motivation-drift", field: "centralClaim" });
  const actual = creativeSignature(a, slot);
  if (actual !== slot.creativeDevice)
    reasons.push({ code: "portfolio.device-mismatch", field: "ugc" });
  // Rationale (insight/persona) and stored evidence are separate from ad prose.
  const visible = comparisonText(
    [
      a.name,
      a.hook,
      ...a.alternativeHooks,
      a.copy,
      a.ugc,
      a.firstThreeSeconds,
      a.cta,
    ].join(" "),
  );
  if (
    slot.evidenceMode === "implicit_evidence" &&
    presentsCustomerProof(visible)
  )
    reasons.push({
      code: "portfolio.explicit-proof-forbidden",
      field: "creative",
    });
  return reasons;
}
export function validatePortfolioSet(
  angles: AngleCandidate[],
  themes: Theme[],
): Rejection[] {
  const reasons: Rejection[] = [];
  const families = angles.map((a) => creativeSignature(a));
  if (families.filter((x) => x === "social_proof").length > 1)
    reasons.push({ code: "portfolio.social-proof-cap", field: "ugc" });
  const motivations = angles.map((a) => motivation(a, themes));
  if (new Set(motivations).size < motivations.length)
    reasons.push({
      code: "portfolio.duplicate-motivation",
      field: "centralClaim",
    });
  const known = families.filter((x) => x !== "unknown");
  if (new Set(known).size < known.length)
    reasons.push({ code: "portfolio.duplicate-execution", field: "ugc" });
  return reasons;
}
