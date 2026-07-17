import { useEffect } from "react";

const SITE = "RarityGrid";
const SITE_URL = "https://raritygrid.com";
const DEFAULT_DESC =
  "Track English Pokémon card prices in USD, explore complete TCG sets, discover market trends and shop real collector listings.";
const PRIVATE_PATH =
  /^\/(?:login|account|admin|binder|cart|dashboard|open-store|orders|profile\/edit|sell(?:-card)?)(?:\/|$)/;

export type PageMetaOptions = {
  type?: "website" | "article" | "product";
  noIndex?: boolean;
  canonicalPath?: string;
  structuredData?: Record<string, unknown>;
};

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMeta(attr: "name" | "property", key: string) {
  document.head
    .querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
    ?.remove();
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  );
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}

/** Sets page metadata, canonical URL and optional schema.org structured data. */
export function usePageMeta(
  title?: string,
  description?: string,
  image?: string,
  options: PageMetaOptions = {}
) {
  const structuredJson = options.structuredData
    ? JSON.stringify(options.structuredData).replaceAll("<", "\\u003c")
    : undefined;

  useEffect(() => {
    const fullTitle = title
      ? `${title} — ${SITE}`
      : `${SITE} — Pokémon Card Prices, Sets & Marketplace`;
    const desc = description ?? DEFAULT_DESC;
    const path = options.canonicalPath ?? window.location.pathname;
    const normalizedPath = path === "/" ? "/" : path.replace(/\/$/, "");
    const canonical = `${SITE_URL}${normalizedPath}`;
    const shouldNoIndex = options.noIndex || PRIVATE_PATH.test(normalizedPath);
    const absoluteImage = image
      ? new URL(image, SITE_URL).toString()
      : undefined;

    document.title = fullTitle;
    setMeta("name", "description", desc);
    setMeta(
      "name",
      "robots",
      shouldNoIndex
        ? "noindex, nofollow"
        : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    );
    setMeta("property", "og:site_name", SITE);
    setMeta("property", "og:locale", "en_US");
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", options.type ?? "website");
    setMeta("property", "og:url", canonical);
    setMeta(
      "name",
      "twitter:card",
      absoluteImage ? "summary_large_image" : "summary"
    );
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", desc);
    setCanonical(canonical);

    if (absoluteImage) {
      setMeta("property", "og:image", absoluteImage);
      setMeta("name", "twitter:image", absoluteImage);
    } else {
      removeMeta("property", "og:image");
      removeMeta("name", "twitter:image");
    }

    const existingScript = document.getElementById("page-structured-data");
    existingScript?.remove();
    if (structuredJson) {
      const script = document.createElement("script");
      script.id = "page-structured-data";
      script.type = "application/ld+json";
      script.text = structuredJson;
      document.head.appendChild(script);
    }

    return () => {
      document.getElementById("page-structured-data")?.remove();
      document.title = `${SITE} — Pokémon Card Prices, Sets & Marketplace`;
    };
  }, [
    title,
    description,
    image,
    options.type,
    options.noIndex,
    options.canonicalPath,
    structuredJson,
  ]);
}
