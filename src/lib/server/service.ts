import "server-only";
import { z } from "zod";
import { AppError, limit, type Context } from "./context";
import { getProject, locked, reserve, saveProject } from "./store";
import { prepareReviews } from "../ingestion";
import { isFixture } from "../fixtures";
import { outputLanguages, requireCurrentOutput } from "../language";
import { advance } from "../analysis/pipeline";
import { modelForStage, OpenAIProvider } from "../analysis/provider";
import { demoProvider } from "../analysis/demo-provider";
import { FollowupSchema, type Project } from "../analysis/schema";
export const ImportSchema = z.object({
  name: z.string().trim().min(1).max(100),
  language: z.enum(outputLanguages),
  reviews: z
    .array(
      z.object({
        text: z.string().max(12000),
        rating: z.number().min(1).max(5).optional(),
        date: z.string().max(100).optional(),
        title: z.string().max(500).optional(),
        source: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(1000),
  excludeNearDuplicates: z.boolean().default(true),
});
export async function createProject(c: Context, input: unknown) {
  const data = ImportSchema.parse(input);
  if (data.reviews.length > limit("MAX_REVIEWS_PER_PROJECT", 200))
    throw new AppError(
      `Import at most ${limit("MAX_REVIEWS_PER_PROJECT", 200)} reviews per project. Split this file into smaller batches.`,
    );
  if (c.demo && data.reviews.some((r) => !isFixture(r.text)))
    throw new AppError(
      "Local demo analyzes bundled synthetic fixtures only. Configure Supabase and OpenAI for your own reviews.",
    );
  const prepared = prepareReviews(data.reviews);
  const reviews = prepared.reviews.filter(
    (r) => !data.excludeNearDuplicates || !r.nearDuplicateOf,
  );
  if (!reviews.length)
    throw new AppError(
      "No usable reviews found. Add a few sentences of customer feedback.",
    );
  const now = new Date().toISOString();
  const p: Project = {
    id: crypto.randomUUID(),
    name: data.name,
    language: data.language,
    demo: c.demo || reviews.every((r) => isFixture(r.text)),
    createdAt: now,
    updatedAt: now,
    reviews,
    extractions: [],
    themes: [],
    insights: [],
    angles: [],
    followups: [],
    run: {
      id: crypto.randomUUID(),
      stage: "ready",
      processed: 0,
      failedReviewIds: [],
      model: c.demo
        ? "synthetic-fixture-rules-v1"
        : [...new Set([modelForStage("FAST"), modelForStage("QUALITY")])].join(
            " / ",
          ),
      scoreVersion: "v1",
    },
  };
  await saveProject(c, p);
  return p;
}
export async function step(c: Context, id: string) {
  return locked(c, id, async () => {
    const p = await getProject(c, id);
    if (p.run.stage === "complete") return p;
    requireCurrentOutput(p.language);
    await reserve(c, p.run.id, "reviews", p.reviews.length);
    const next = await advance(p, c.demo ? demoProvider : new OpenAIProvider());
    await saveProject(c, next);
    return next;
  });
}
export const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), angleId: z.string().uuid() }),
  z.object({ action: z.literal("hooks"), angleId: z.string().uuid() }),
  z.object({ action: z.literal("ugc"), angleId: z.string().uuid() }),
  z.object({ action: z.literal("translate"), reviewId: z.string().uuid() }),
  z.object({ action: z.literal("retry_missing") }),
]);
export async function action(c: Context, id: string, input: unknown) {
  const data = ActionSchema.parse(input);
  return locked(c, id, async () => {
    const p = await getProject(c, id);
    if (data.action !== "save") requireCurrentOutput(p.language);
    const provider = c.demo ? demoProvider : new OpenAIProvider();
    if (data.action === "translate") {
      if (c.demo)
        throw new AppError(
          "Review translation requires a configured OpenAI account. Original synthetic quotes remain available.",
        );
      const review = p.reviews.find((r) => r.id === data.reviewId);
      if (!review) throw new AppError("Review not found.", 404);
      await reserve(c, crypto.randomUUID(), "followup", 1);
      return { translation: await provider.translate(review, p.language) };
    }
    if (data.action === "retry_missing") {
      if (!p.run.failedReviewIds.length)
        throw new AppError("No missing reviews to retry.");
      p.run.failedReviewIds = [];
      p.run.stage = "extracting";
      p.run.error = undefined;
      p.run.themeCursor = 0;
      p.run.themeGroups = [];
      p.themes = [];
      p.insights = [];
      p.angles = [];
      p.followups = [];
      await saveProject(c, p);
      return { project: p };
    }
    const angle = p.angles.find((a) => a.id === data.angleId);
    if (!angle) throw new AppError("Angle not found.", 404);
    if (data.action === "save") angle.saved = !angle.saved;
    else {
      await reserve(c, crypto.randomUUID(), "followup", 1);
      const result = FollowupSchema.parse(
        await provider.followup(
          angle,
          p.reviews.filter((r) => angle.reviewIds.includes(r.id)),
          data.action,
          p.language,
          p.themes.filter((t) => angle.themeIds.includes(t.id)),
        ),
      );
      if (
        !result.reviewIds.length ||
        result.reviewIds.some((r) => !angle.reviewIds.includes(r))
      )
        throw new AppError(
          "Generated content could not be linked to this angle’s evidence. Try again.",
          502,
        );
      p.followups.push({
        id: crypto.randomUUID(),
        angleId: angle.id,
        kind: data.action,
        content: result.content,
        reviewIds: [...new Set(result.reviewIds)],
        createdAt: new Date().toISOString(),
      });
      if (provider.telemetry) {
        const previous = p.run.telemetry || { usage: [], selection: [] };
        p.run.telemetry = {
          usage: [...previous.usage, ...provider.telemetry.usage],
          selection: [...previous.selection, ...provider.telemetry.selection],
        };
      }
    }
    p.updatedAt = new Date().toISOString();
    await saveProject(c, p);
    return { project: p };
  });
}
