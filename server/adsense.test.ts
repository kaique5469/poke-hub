import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "./securityHeaders";

const publisherId = "ca-pub-7988448644339439";

describe("AdSense integration", () => {
  it("publishes the ownership code in the global document head", () => {
    const html = readFileSync(resolve("client/index.html"), "utf8");

    expect(html).toContain(`content="${publisherId}"`);
    expect(html).toContain(
      `adsbygoogle.js?client=${publisherId}`
    );
    expect(html.indexOf("adsbygoogle.js")).toBeLessThan(
      html.indexOf("</head>")
    );
  });

  it("publishes an authorized-seller declaration", () => {
    const adsTxt = readFileSync(resolve("client/public/ads.txt"), "utf8");

    expect(adsTxt.trim()).toBe(
      "google.com, pub-7988448644339439, DIRECT, f08c47fec0942fa0"
    );
  });

  it("allows required AdSense hosts without allowing arbitrary scripts", () => {
    const scriptDirective = CONTENT_SECURITY_POLICY.split("; ").find(
      directive => directive.startsWith("script-src ")
    );

    expect(CONTENT_SECURITY_POLICY).toContain(
      "script-src 'self' https://pagead2.googlesyndication.com"
    );
    expect(CONTENT_SECURITY_POLICY).toContain(
      "https://fundingchoicesmessages.google.com"
    );
    expect(scriptDirective?.split(" ")).not.toContain("https:");
    expect(scriptDirective?.split(" ")).not.toContain("*");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
  });
});
