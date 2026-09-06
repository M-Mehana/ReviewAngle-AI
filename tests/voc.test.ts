import { expect, it } from "vitest";
import { prepareReviews } from "../src/lib/ingestion";
import { repeatedPhrases } from "../src/lib/analysis/voc";
it("counts exact recurring phrases from distinct reviews and preserves original casing", () => {
  const reviews = prepareReviews([
    { text: "My coffee stays warm until lunch." },
    { text: "The coffee stays warm throughout my shift." },
    { text: "The lid is difficult to clean." },
  ]).reviews;
  const phrase = repeatedPhrases(reviews).find(
    (p) => p.phrase === "coffee stays warm",
  );
  expect(phrase?.reviewIds).toHaveLength(2);
  expect(phrase?.reviewIds).not.toContain(reviews[2].id);
});
