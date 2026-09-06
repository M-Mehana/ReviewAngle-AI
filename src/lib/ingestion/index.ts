import Papa from "papaparse";
import { detectLanguage } from "../language";
export type RawReview = {
  text: string;
  rating?: number;
  date?: string;
  title?: string;
  source?: string;
};
export type Review = RawReview & {
  id: string;
  normalized: string;
  masked: string;
  language: string;
  nearDuplicateOf?: string;
};
export function normalize(text: string): string {
  return text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      const v = Number(n);
      return v <= 0x10ffff ? String.fromCodePoint(v) : "";
    })
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function maskPII(text: string) {
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[EMAIL]")
    .replace(
      /(?<![\p{L}\d])\+?[\d٠-٩][\d٠-٩\s().-]{7,}[\d٠-٩](?![\p{L}\d])/gu,
      "[PHONE]",
    );
}
function fingerprint(text: string) {
  return normalize(text)
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, "");
}
function similarity(a: string, b: string) {
  const tokens = (v: string) => new Set(v.toLowerCase().split(/\s+/));
  const x = tokens(a),
    y = tokens(b);
  if (Math.min(x.size, y.size) < 6) return 0;
  const intersection = [...x].filter((v) => y.has(v)).length;
  return intersection / (x.size + y.size - intersection);
}
export function prepareReviews(rows: RawReview[], existing: Review[] = []) {
  const reviews: Review[] = [],
    rejected: { row: number; reason: string }[] = [];
  const seen = new Set(existing.map((r) => fingerprint(r.normalized)));
  rows.forEach((row, i) => {
    const normalized = normalize(row.text);
    if (
      (normalized.match(/\p{L}/gu) || []).length < 3 ||
      /^(n\/?a|none|null|test|---)$/i.test(normalized)
    ) {
      rejected.push({ row: i + 1, reason: "empty" });
      return;
    }
    if (normalized.length > 6000) {
      rejected.push({ row: i + 1, reason: "too_long" });
      return;
    }
    const key = fingerprint(normalized);
    if (seen.has(key)) {
      rejected.push({ row: i + 1, reason: "duplicate" });
      return;
    }
    seen.add(key);
    const near = [...existing, ...reviews].find(
      (r) => similarity(r.normalized, normalized) >= 0.88,
    );
    reviews.push({
      ...row,
      id: crypto.randomUUID(),
      normalized,
      masked: maskPII(normalized),
      language: detectLanguage(normalized),
      ...(near ? { nearDuplicateOf: near.id } : {}),
    });
  });
  return { reviews, rejected };
}
export function parsePaste(text: string): RawReview[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((text) => ({ text: text.trim(), source: "Paste" }))
    .filter((r) => r.text);
}
export function parseCSV(text: string) {
  const result = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    },
  );
  if (result.errors.length)
    throw new Error(`Invalid CSV: ${result.errors[0].message}`);
  const columns = result.meta.fields || [];
  if (!columns.length || !result.data.length)
    throw new Error(
      "CSV has no data rows. Include a header row and at least one review.",
    );
  return { columns, rows: result.data };
}
export function mapColumns(
  rows: Record<string, string>[],
  mapping: { text: string; rating?: string; date?: string; title?: string },
  source = "CSV",
): RawReview[] {
  if (!mapping.text || !rows.every((r) => Object.hasOwn(r, mapping.text)))
    throw new Error("Choose a review text column.");
  return rows.map((r) => {
    const rating = mapping.rating ? Number(r[mapping.rating]) : NaN;
    return {
      text: r[mapping.text],
      source,
      ...(rating >= 1 && rating <= 5 ? { rating } : {}),
      ...(mapping.date && r[mapping.date] ? { date: r[mapping.date] } : {}),
      ...(mapping.title ? { title: r[mapping.title] } : {}),
    };
  });
}
