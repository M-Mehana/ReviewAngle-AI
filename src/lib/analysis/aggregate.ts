import type { Extraction, Theme } from "./schema";
export function factCatalog(extractions: Extraction[]) {
  return extractions.flatMap((e) =>
    e.facts.map((f, i) => ({
      ...f,
      key: `${e.reviewId}:${i}`,
      reviewId: e.reviewId,
    })),
  );
}
export function aggregate(
  extractions: Extraction[],
  groups: { label: string; factKeys: string[] }[],
): Theme[] {
  const catalog = factCatalog(extractions),
    used = new Set<string>();
  const themes: Theme[] = [];
  const add = (label: string, keys: string[]) => {
    const facts = keys.map((k) => catalog.find((f) => f.key === k));
    if (facts.some((f) => !f))
      throw new Error(
        "Theme references unknown extraction. Retry theme aggregation.",
      );
    const partitions = new Map<string, typeof catalog>();
    for (const fact of facts) {
      if (!fact || used.has(fact.key)) continue;
      used.add(fact.key);
      const key = `${fact.category}/${fact.scope}`;
      partitions.set(key, [...(partitions.get(key) || []), fact]);
    }
    for (const items of partitions.values()) {
      const reviewIds = [...new Set(items.map((f) => f.reviewId))];
      themes.push({
        id: crypto.randomUUID(),
        label,
        category: items[0].category,
        scope: items[0].scope,
        reviewIds,
        count: reviewIds.length,
        quotes: [
          ...new Map(
            items.map((f) => [
              `${f.reviewId}:${f.quote}`,
              { reviewId: f.reviewId, quote: f.quote },
            ]),
          ).values(),
        ],
      });
    }
  };
  groups.forEach((g) => add(g.label, g.factKeys));
  catalog.filter((f) => !used.has(f.key)).forEach((f) => add(f.label, [f.key]));
  return themes.sort((a, b) => b.count - a.count);
}
