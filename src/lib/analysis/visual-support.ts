// Input is comparison-normalized; no evidence is modified. Each concept requires
// both an appearance outcome and its target, irrespective of word order.
const density =
  /dens|thick|fuller|full looking|كثف|كثاف|كثيف|تكثيف|امتل|ممتل|تقلت|اتقلت|اتقل/;
const length = /longer|length|grew|growth|اطول|طول|نمو/;
export const appearanceConcepts = {
  eyebrow_density: { target: /brows?|eyebrow|حواجب|حاجب/, outcome: density },
  lash_density: { target: /lashes|eyelash|رموش|رمش/, outcome: density },
  lash_length: { target: /lashes|eyelash|رموش|رمش/, outcome: length },
  nail_length: { target: /nails?|اظافر|ضوافر|ظفر/, outcome: length },
  hair_density: { target: /\bhair\b|\bscalp\b|شعر|فروه/, outcome: density },
  skin_marks: {
    target: /marks?|spots?|pigment|بقع|تصبغ/,
    outcome: /reduc|less|faded|lighter|تراجع|اقل|خف|فتح/,
  },
  wrinkle_appearance: {
    target: /wrinkles?|تجاعيد/,
    outcome: /reduc|less|smoother|تراجع|اقل|خف/,
  },
} as const;
export function visualConcepts(text: string): string[] {
  if (
    /(?:did not|didn t|not|لم|لا|مش).{0,15}(?:increase|grow|thicken|تزد|تزيد|كثف|يطول|طولت)/.test(
      text,
    )
  )
    return [];
  const occurrences = (pattern: RegExp) => [
    ...text.matchAll(new RegExp(pattern.source, "g")),
  ];
  const targets = Object.entries(appearanceConcepts).flatMap(([key, v]) =>
    occurrences(v.target).map((m) => ({
      key,
      start: m.index!,
      end: m.index! + m[0].length,
    })),
  );
  const distance = (
    a: { start: number; end: number },
    b: { start: number; end: number },
  ) => Math.max(0, a.start - b.end, b.start - a.end);
  // A product name may mention multiple targets. Bind each outcome to the
  // nearest explicit target rather than assigning it to every noun in a field.
  const found = Object.entries(appearanceConcepts)
    .filter(([key, v]) =>
      occurrences(v.outcome).some((m) => {
        const outcome = { start: m.index!, end: m.index! + m[0].length };
        const nearest = Math.min(...targets.map((t) => distance(t, outcome)));
        return targets.some(
          (t) => t.key === key && distance(t, outcome) === nearest,
        );
      }),
    )
    .map(([key]) => key);
  if (
    !found.length &&
    density.test(text) &&
    /appearance|looking|مظهر|شكل|كثاف|اكثف|density/.test(text)
  )
    found.push("density");
  return found;
}
export function supportsVisualConcepts(
  generated: string[],
  evidence: string[],
) {
  return generated.every(
    (c) =>
      evidence.includes(c) ||
      (c === "density" && evidence.some((e) => e.endsWith("_density"))),
  );
}
