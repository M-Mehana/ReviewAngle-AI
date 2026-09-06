import { htmlConnector } from "./types";
export const generic = htmlConnector(
  "Public review HTML",
  '[itemtype$="/Review"], [data-review], .review-item',
  '[itemprop="reviewBody"], [data-review-body], .review-body',
  '[itemprop="ratingValue"]',
);
