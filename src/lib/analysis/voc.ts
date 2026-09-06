import type { Review } from "../ingestion";
// Repeated wording is counted directly; semantic theme frequency is a separate metric.
export function repeatedPhrases(reviews: Review[]) {
  const phrases = new Map<string, { phrase: string; reviewIds: string[] }>();
  for (const review of reviews) {
    const tokens = [
      ...review.masked.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu),
    ];
    for (let size = 3; size <= 7; size++)
      for (let start = 0; start + size <= tokens.length; start++) {
        const end = tokens[start + size - 1];
        const phrase = review.masked.slice(
          tokens[start].index!,
          end.index! + end[0].length,
        );
        if (phrase.includes("[EMAIL]") || phrase.includes("[PHONE]")) continue;
        const key = phrase.toLowerCase();
        const item = phrases.get(key) || { phrase, reviewIds: [] };
        if (!item.reviewIds.includes(review.id)) item.reviewIds.push(review.id);
        phrases.set(key, item);
      }
  }
  const repeated = [...phrases.values()]
    .filter((p) => p.reviewIds.length >= 2)
    .sort(
      (a, b) =>
        b.reviewIds.length - a.reviewIds.length ||
        b.phrase.length - a.phrase.length,
    );
  const selected: typeof repeated = [];
  for (const phrase of repeated) {
    if (
      selected.some(
        (p) =>
          p.phrase.toLowerCase().includes(phrase.phrase.toLowerCase()) &&
          phrase.reviewIds.every((id) => p.reviewIds.includes(id)),
      )
    )
      continue;
    selected.push(phrase);
    if (selected.length >= 20) break;
  }
  return selected;
}
