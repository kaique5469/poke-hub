import { useEffect } from "react";

const SITE = "TCG Arena";
const DEFAULT_DESC = "The complete Pokémon TCG platform for the USA — cards, prices, marketplace, decks, tournaments and more.";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Sets document title + description + OpenGraph tags for the current page.
 * Usage: usePageMeta("Shop", "Buy sealed Pokémon TCG products…")
 */
export function usePageMeta(title?: string, description?: string, image?: string) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE}` : `${SITE} — Pokémon TCG Platform for the USA`;
    const desc = description ?? DEFAULT_DESC;

    document.title = fullTitle;
    setMeta("name", "description", desc);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", "website");
    if (image) setMeta("property", "og:image", image);

    return () => {
      document.title = `${SITE} — Pokémon TCG Platform for the USA`;
    };
  }, [title, description, image]);
}
