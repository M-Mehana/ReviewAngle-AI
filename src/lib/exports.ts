import Papa from "papaparse";
import type { Project } from "./analysis/schema";
export function anglesText(p: Project) {
  return p.angles
    .map(
      (a) =>
        `${a.name}\n${a.hook}\n${a.copy}\n${a.cta}\nEvidence: ${a.score}/100 · ${a.reviewIds.length} reviews\nReview IDs: ${a.reviewIds.join(", ")}`,
    )
    .join("\n\n");
}
export function csvExport(p: Project) {
  return (
    "\uFEFF" +
    Papa.unparse(
      p.angles.map((a) => ({
        name: a.name,
        type: a.type,
        persona: a.persona,
        insight: a.insight,
        evidence_score: a.score,
        support_count: a.reviewIds.length,
        review_ids: a.reviewIds.join(";"),
        hook: a.hook,
        alternative_hooks: a.alternativeHooks.join("\n"),
        ad_copy: a.copy,
        ugc: a.ugc,
        first_three_seconds: a.firstThreeSeconds,
        cta: a.cta,
        synthetic: p.demo,
      })),
      { escapeFormulae: true },
    )
  );
}
export function jsonExport(p: Project) {
  return JSON.stringify(
    { schemaVersion: 1, exportedAt: new Date().toISOString(), ...p },
    null,
    2,
  );
}
