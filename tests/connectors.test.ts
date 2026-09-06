import { describe, it, expect, vi } from "vitest";
import { load } from "cheerio";
import { judgeme } from "../src/lib/connectors/judgeme";
import { generic } from "../src/lib/connectors/generic";
import { domainPolicy } from "../src/lib/connectors/policy";
describe("permitted HTML connectors", () => {
  it("extracts visible Judge.me markup, skips hidden review containers", () => {
    const $ = load(
      '<div class="jdgm-rev"><div class="jdgm-rev__body">Coffee stays warm.</div><span class="jdgm-rev__rating" data-score="5"></span></div><div hidden><div class="jdgm-rev"><div class="jdgm-rev__body">Hidden text.</div></div></div>',
    );
    expect(judgeme.extract($)).toEqual([
      { text: "Coffee stays warm.", rating: 5, source: "Judge.me" },
    ]);
  });
  it("does not interpret arbitrary page text as reviews", () =>
    expect(
      generic.extract(
        load("<main>A product description without reviews</main>"),
      ),
    ).toHaveLength(0));
  it("defaults unknown domains to manual import and applies explicit domain boundary", () => {
    vi.stubEnv("URL_SUPPORTED_DOMAINS", "shop.example.com");
    vi.stubEnv("URL_DISABLED_DOMAINS", "blocked.shop.example.com");
    expect(domainPolicy("shop.example.com")).toBe("supported");
    expect(domainPolicy("evilshop.example.com")).toBe("manual-import-only");
    expect(domainPolicy("blocked.shop.example.com")).toBe("disabled");
    vi.unstubAllEnvs();
  });
});
