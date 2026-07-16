export type RetailerLink = {
  id: "pokemon_center" | "tcgplayer" | "target" | "ebay";
  name: string;
  url: string;
  description: string;
  official?: boolean;
};

const searchTerm = (name: string) =>
  `Pokemon TCG ${name}`.replace(/\s+/g, " ").trim();
const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Search links are intentionally generated from verified product names. */
export function getRetailerLinks(productName: string): RetailerLink[] {
  const query = searchTerm(productName);
  return [
    {
      id: "pokemon_center",
      name: "Pokémon Center",
      url: `https://www.pokemoncenter.com/search/${slug(productName)}`,
      description: "Official Pokémon store",
      official: true,
    },
    {
      id: "tcgplayer",
      name: "TCGplayer",
      url: `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(productName)}&view=grid`,
      description: "Compare marketplace listings",
    },
    {
      id: "target",
      name: "Target",
      url: `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`,
      description: "Search current retail stock",
    },
    {
      id: "ebay",
      name: "eBay",
      url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`,
      description: "Compare new and resale listings",
    },
  ];
}
