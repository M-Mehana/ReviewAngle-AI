import { load } from "cheerio";
import robotsParser from "robots-parser";
import { fetchPublic, validateURL } from "./security";
import { requireSupported } from "./policy";
import { judgeme } from "./judgeme";
import { loox } from "./loox";
import { yotpo } from "./yotpo";
import { okendo } from "./okendo";
import { stamped } from "./stamped";
import { generic } from "./generic";
export const connectors = [judgeme, loox, yotpo, okendo, stamped, generic];
export async function importURL(input: string) {
  const url = validateURL(input);
  requireSupported(url);
  // Fail closed if robots cannot be read; no inference that unknown permission is permission.
  const robots = await fetchPublic(
    new URL("/robots.txt", url).href,
    requireSupported,
    { maxBytes: 256_000, timeout: 6000, redirects: 2 },
  );
  const parser = robotsParser(new URL("/robots.txt", url).href, robots.body);
  if (parser.isAllowed(url.href, "ReviewAngleAI") === false)
    throw new Error(
      "This site does not permit automated access. Paste or upload reviews instead.",
    );
  const page = await fetchPublic(url.href, (u) => {
    requireSupported(u);
    if (
      u.origin !== url.origin ||
      parser.isAllowed(u.href, "ReviewAngleAI") === false
    )
      throw new Error(
        "This redirect requires manual import. Paste or upload reviews instead.",
      );
  });
  if (!page.type.includes("text/html"))
    throw new Error(
      "This URL is not a public HTML page. Use file import instead.",
    );
  const $ = load(page.body);
  $('script,style,template,[hidden],[aria-hidden="true"]').remove();
  for (const connector of connectors) {
    const reviews = connector.extract($);
    if (reviews.length)
      return {
        connector: connector.id,
        reviews: reviews
          .slice(0, 200)
          .map((r) => ({ ...r, source: `${connector.id} · ${url.hostname}` })),
        truncated: reviews.length > 200,
      };
  }
  throw new Error(
    "No visible reviews were found in this page’s HTML. Reviews may load dynamically. Paste or upload them instead.",
  );
}
