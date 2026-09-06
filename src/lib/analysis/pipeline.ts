import {
  AnglesSchema,
  ExtractionSchema,
  IntelligenceSchema,
  ThemeMappingSchema,
  type Project,
} from "./schema";
import type { ModelProvider } from "./provider";
import { aggregate } from "./aggregate";
import {
  evidenceForThemes,
  scoreEvidence,
  strength,
  validateExtractions,
} from "./evidence";
export async function advance(
  project: Project,
  provider: ModelProvider,
): Promise<Project> {
  const p = structuredClone(project);
  p.run.error = undefined;
  if (p.run.stage === "failed") p.run.stage = p.run.resumeStage || "extracting";
  if (p.run.stage === "ready") p.run.stage = "extracting";
  const stage = p.run.stage;
  try {
    if (stage === "extracting") {
      const pending = p.reviews.filter(
        (r) =>
          !p.extractions.some((e) => e.reviewId === r.id) &&
          !p.run.failedReviewIds.includes(r.id),
      );
      const batch = pending.slice(0, 6);
      if (batch.length) {
        const output = ExtractionSchema.parse(await provider.extract(batch));
        const records = validateExtractions(output.records, batch);
        p.run.rejectedFacts =
          (p.run.rejectedFacts || 0) +
          output.records.reduce((n, r) => n + r.facts.length, 0) -
          records.reduce((n, r) => n + r.facts.length, 0);
        const missing = batch
          .filter((r) => !records.some((e) => e.reviewId === r.id))
          .map((r) => r.id);
        p.run.failedReviewIds.push(...missing);
        p.extractions.push(...records);
        p.run.processed = p.extractions.length;
      }
      if (pending.length <= 6) {
        if (!p.extractions.length)
          throw new Error(
            "No reviews were successfully extracted. Retry the analysis.",
          );
        p.run.stage = "themes";
      }
    } else if (stage === "themes") {
      const cursor = p.run.themeCursor || 0;
      const batch = p.extractions.slice(cursor, cursor + 10);
      const output = ThemeMappingSchema.parse(
        await provider.group(batch, p.language, [
          ...new Set((p.run.themeGroups || []).map((g) => g.label)),
        ]),
      );
      // Reject invalid fact keys before persisting the batch.
      aggregate(batch, output.groups);
      p.run.themeGroups = [...(p.run.themeGroups || []), ...output.groups];
      p.run.themeCursor = cursor + batch.length;
      if (p.run.themeCursor >= p.extractions.length) {
        const merged = new Map<string, string[]>();
        p.run.themeGroups.forEach((g) =>
          merged.set(g.label, [...(merged.get(g.label) || []), ...g.factKeys]),
        );
        p.themes = aggregate(
          p.extractions,
          [...merged].map(([label, factKeys]) => ({ label, factKeys })),
        );
        if (!p.themes.length)
          throw new Error(
            "No usable customer evidence found. Add more detailed reviews.",
          );
        p.run.stage = "intelligence";
      }
    } else if (stage === "intelligence") {
      const selected = p.themes
        .slice(0, 80)
        .map((t) => ({ ...t, quotes: t.quotes.slice(0, 2) }));
      const output = IntelligenceSchema.parse(
        await provider.intelligence(selected, p.language),
      );
      p.insights = output.insights.map((i) => ({
        ...i,
        id: crypto.randomUUID(),
        reviewIds: evidenceForThemes(i.themeIds, p.themes),
      }));
      p.run.stage = "angles";
    } else if (stage === "angles") {
      const selected = p.themes
        .slice(0, 80)
        .map((t) => ({ ...t, quotes: t.quotes.slice(0, 2) }));
      const output = AnglesSchema.parse(
        await provider.angles(selected, p.language),
      );
      if (!output.angles.length)
        throw new Error("No grounded angles returned. Retry angle generation.");
      p.angles = output.angles.slice(0, 12).map((a) => {
        const reviewIds = evidenceForThemes(a.themeIds, p.themes);
        const { score, breakdown } = scoreEvidence(
          reviewIds,
          a.themeIds,
          p.themes,
          p.extractions,
        );
        return {
          ...a,
          id: crypto.randomUUID(),
          reviewIds,
          score,
          scoreBreakdown: breakdown,
          strength: strength(score),
          saved: false,
        };
      });
      p.angles.sort((a, b) => b.score - a.score);
      p.run.stage = "complete";
    }
  } catch (error) {
    p.run.stage = "failed";
    p.run.resumeStage = stage;
    p.run.error =
      error instanceof Error && !("status" in error)
        ? error.message
        : "The AI service could not complete this step. Check your API configuration or rate limit, then retry.";
  }
  p.updatedAt = new Date().toISOString();
  return p;
}
