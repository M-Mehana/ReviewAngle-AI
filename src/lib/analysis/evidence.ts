import type { Angle, Extraction, Theme } from "./schema";
import type { Review } from "../ingestion";
export function validateExtractions(
  records: Extraction[],
  reviews: Review[],
): Extraction[] {
  const seen = new Set<string>();
  return records.map((record) => {
    const review = reviews.find((r) => r.id === record.reviewId);
    if (!review || seen.has(record.reviewId))
      throw new Error(
        "Model returned an unknown or duplicate review ID. Retry this batch.",
      );
    seen.add(record.reviewId);
    const facts = record.facts.filter(
      (f) => f.quote.trim().length >= 3 && review.masked.includes(f.quote),
    );
    return { ...record, facts };
  });
}
export function evidenceForThemes(ids: string[], themes: Theme[]) {
  if (!ids.length || ids.some((id) => !themes.some((t) => t.id === id)))
    throw new Error(
      "Generated content referenced missing evidence. Please retry.",
    );
  return [
    ...new Set(
      themes.filter((t) => ids.includes(t.id)).flatMap((t) => t.reviewIds),
    ),
  ];
}
export function scoreEvidence(
  reviewIds: string[],
  themeIds: string[],
  themes: Theme[],
  extractions: Extraction[],
) {
  const ids = [...new Set(reviewIds)].filter((id) =>
    extractions.some((e) => e.reviewId === id),
  );
  const records = extractions.filter((e) => ids.includes(e.reviewId));
  const n = records.length;
  if (!n)
    return {
      score: 0,
      breakdown: {
        frequency: 0,
        consistency: 0,
        emotion: 0,
        specificity: 0,
        usability: 0,
      },
    };
  const related = themes.filter((t) => themeIds.includes(t.id));
  const breakdown = {
    frequency: Math.min(1, n / Math.max(1, extractions.length) / 0.25),
    consistency:
      records.filter(
        (e) =>
          related.length > 0 &&
          related.every((t) => t.reviewIds.includes(e.reviewId)),
      ).length / n,
    emotion:
      records.filter((e) => e.facts.some((f) => f.category === "emotion"))
        .length / n,
    specificity:
      records.filter((e) => e.facts.some((f) => f.quote.length >= 40)).length /
      n,
    usability:
      records.filter((e) =>
        e.facts.some((f) =>
          ["benefit", "pain", "outcome", "use_case"].includes(f.category),
        ),
      ).length / n,
  };
  const weighted =
    breakdown.frequency * 35 +
    breakdown.consistency * 25 +
    breakdown.emotion * 15 +
    breakdown.specificity * 15 +
    breakdown.usability * 10;
  return {
    score: Math.min(
      Math.round(weighted),
      n === 1 ? 40 : n === 2 ? 60 : n < 5 ? 75 : 100,
    ),
    breakdown,
  };
}
export function strength(score: number): Angle["strength"] {
  return score >= 70 ? "strong" : score >= 45 ? "emerging" : "limited";
}
