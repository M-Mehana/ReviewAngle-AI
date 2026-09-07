import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function performanceReviews(count) {
  if (!Number.isInteger(count) || count < 50 || count > 200)
    throw new Error("Performance fixtures require 50–200 rows.");
  const words = [
    "amber",
    "birch",
    "cedar",
    "dawn",
    "elm",
    "fern",
    "grove",
    "hazel",
    "iris",
    "juniper",
    "kelp",
    "linen",
    "maple",
    "north",
    "olive",
    "pine",
    "quartz",
    "reed",
    "sage",
    "thyme",
  ];
  return Array.from({ length: count }, (_, i) => ({
    text: `NON-CUSTOMER PERFORMANCE TEST. Case ${words[i % 20]} ${words[Math.floor(i / 20)]}. Synthetic observation: the mug keeps tea warm. Test identifiers ${Array.from({ length: 8 }, (_, j) => `marker${i}part${j}`).join(" ")}.`,
    rating: 4,
    source: "NON-CUSTOMER performance fixture",
  }));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const folder = path.resolve(".local/validation-datasets");
  await mkdir(folder, { recursive: true });
  await writeFile(
    path.join(folder, "genuine-reviews-template.csv"),
    "text,rating,date,title,source\n",
  );
  const rows = performanceReviews(200);
  await writeFile(
    path.join(folder, "NON-CUSTOMER-performance-200.csv"),
    "text,rating,source\n" +
      rows
        .map((r) =>
          [r.text, r.rating, r.source]
            .map((v) => `"${String(v).replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n"),
  );
  console.log(
    JSON.stringify({
      folder,
      rows: rows.length,
      provenance:
        "generated non-customer load fixture; not genuine product reviews",
    }),
  );
}
