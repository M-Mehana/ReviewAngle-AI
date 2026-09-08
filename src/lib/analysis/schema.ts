import { z } from "zod";
import type { Review } from "../ingestion";
import type { StoredOutputLanguage as OutputLanguage } from "../language";
export const categories = [
  "attribute",
  "pain",
  "benefit",
  "outcome",
  "objection",
  "use_case",
  "persona",
  "emotion",
  "comparison",
  "unexpected",
  "complaint",
  "feature_request",
] as const;
export const FactSchema = z.object({
  category: z.enum(categories),
  label: z.string().max(200),
  quote: z.string().max(500),
  scope: z.enum(["product", "shipping", "seller", "packaging", "support"]),
});
export const ExtractionSchema = z.object({
  records: z
    .array(
      z.object({
        reviewId: z.string(),
        sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
        facts: z.array(FactSchema).max(24),
      }),
    )
    .max(6),
});
export type Extraction = z.infer<typeof ExtractionSchema>["records"][number];
export const ThemeMappingSchema = z.object({
  groups: z.array(
    z.object({ label: z.string(), factKeys: z.array(z.string()) }),
  ),
});
export type Theme = {
  id: string;
  label: string;
  category: (typeof categories)[number];
  scope: string;
  reviewIds: string[];
  count: number;
  quotes: { reviewId: string; quote: string }[];
};
export const IntelligenceSchema = z.object({
  insights: z.array(
    z.object({
      category: z.enum([
        "purchase_reason",
        "benefit",
        "pain",
        "objection",
        "use_case",
        "unexpected",
        "persona",
        "emotion",
        "comparison",
        "product_opportunity",
        "messaging_opportunity",
      ]),
      title: z.string(),
      description: z.string(),
      themeIds: z.array(z.string()),
    }),
  ),
});
export type Insight = z.infer<typeof IntelligenceSchema>["insights"][number] & {
  id: string;
  reviewIds: string[];
};
export const AnglesSchema = z.object({
  angles: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      persona: z.string(),
      insight: z.string(),
      themeIds: z.array(z.string()),
      hook: z.string(),
      alternativeHooks: z.array(z.string()),
      copy: z.string(),
      ugc: z.string(),
      firstThreeSeconds: z.string(),
      cta: z.string(),
    }),
  ),
});
export type Angle = z.infer<typeof AnglesSchema>["angles"][number] & {
  id: string;
  reviewIds: string[];
  score: number;
  scoreBreakdown: Record<string, number>;
  strength: "limited" | "emerging" | "strong";
  saved: boolean;
};
export const FollowupSchema = z.object({
  content: z.string(),
  reviewIds: z.array(z.string()),
});
export type Followup = {
  id: string;
  angleId: string;
  kind: "hooks" | "ugc";
  content: string;
  reviewIds: string[];
  createdAt: string;
};
export type Stage =
  | "ready"
  | "extracting"
  | "themes"
  | "intelligence"
  | "angles"
  | "complete"
  | "failed";
export type Project = {
  id: string;
  name: string;
  language: OutputLanguage;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
  reviews: Review[];
  extractions: Extraction[];
  themes: Theme[];
  insights: Insight[];
  angles: Angle[];
  followups: Followup[];
  run: {
    id: string;
    stage: Stage;
    processed: number;
    failedReviewIds: string[];
    rejectedFacts?: number;
    error?: string;
    resumeStage?: Stage;
    model: string;
    scoreVersion: string;
    themeCursor?: number;
    themeGroups?: { label: string; factKeys: string[] }[];
    telemetry?: {
      usage: import("./provider").UsageEvent[];
      selection: import("./selective-repair").SelectionEvent[];
    };
  };
};
