import { describe, expect, it } from "vitest";
import {
  SITE_URL,
  getRouteSeo,
  injectSeoMetadata,
  isKnownClientRoute,
} from "./seo";

const template = `<!doctype html><html><head>
<title>Old title</title>
<meta name="description" content="Old description" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="Old title" />
<meta property="og:description" content="Old description" />
<meta property="og:url" content="https://old.example/" />
<link rel="canonical" href="https://old.example/" />
</head><body></body></html>`;

describe("SEO metadata", () => {
  it("uses raritygrid.com as the canonical origin", () => {
    const html = injectSeoMetadata(template, "/sets/base1");
    expect(html).toContain(`href="${SITE_URL}/sets/base1"`);
    expect(html).toContain(`content="${SITE_URL}/sets/base1"`);
    expect(html).not.toContain("old.example");
  });

  it("blocks private and missing pages from indexing", () => {
    expect(getRouteSeo("/account").noIndex).toBe(true);
    expect(getRouteSeo("/unknown", 404).noIndex).toBe(true);
    expect(injectSeoMetadata(template, "/account")).toContain(
      'content="noindex, nofollow"'
    );
  });

  it("recognizes public detail routes but not arbitrary paths", () => {
    expect(isKnownClientRoute("/cards/sv4-198")).toBe(true);
    expect(isKnownClientRoute("/articles/market-update")).toBe(true);
    expect(isKnownClientRoute("/not-a-real-route")).toBe(false);
  });
});
