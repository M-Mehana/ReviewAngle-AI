import type { CheerioAPI } from "cheerio";
import type { RawReview } from "../ingestion";
export type Connector = { id: string; extract: ($: CheerioAPI) => RawReview[] };
export function htmlConnector(
  id: string,
  root: string,
  textSelector: string,
  ratingSelector?: string,
): Connector {
  return {
    id,
    extract: ($) =>
      $(root)
        .toArray()
        .filter(
          (el) =>
            !$(el).parents('[hidden],[aria-hidden="true"],script,template')
              .length && !$(el).is('[hidden],[aria-hidden="true"]'),
        )
        .map((el) => {
          const node = $(el);
          const raw = ratingSelector
            ? node.find(ratingSelector).first().attr("data-score") ||
              node.find(ratingSelector).first().attr("content") ||
              node.find(ratingSelector).first().text()
            : "";
          const rating = Number(raw);
          return {
            text: node.find(textSelector).first().text().trim(),
            ...(rating >= 1 && rating <= 5 ? { rating } : {}),
            source: id,
          };
        })
        .filter((r) => r.text.length > 2),
  };
}
