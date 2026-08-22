import type { PtcgCard } from "./pokemontcg";
import { correctSearchText, searchSimilarity } from "./searchRelevance";

export type HistoricCardRecord = PtcgCard & {
  catalogRecord: {
    kind: "historic";
    sourceName: string;
    sourceUrl: string;
    verifiedAt: string;
    note: string;
  };
};

const HISTORIC_CARDS: HistoricCardRecord[] = [
  {
    id: "historic:pikachu-illustrator-1998",
    name: "Pikachu Illustrator",
    supertype: "Pokémon",
    subtypes: ["Promo"],
    types: ["Lightning"],
    number: "Illustrator",
    artist: "Atsuko Nishida",
    rarity: "Japanese Contest Promo",
    set: {
      id: "japanese-illustration-contest-promos",
      name: "1998 Pokémon Illustration Contest Promo",
      series: "Japanese Promotional Cards",
      printedTotal: 39,
      total: 39,
      releaseDate: "1998-01-01",
      updatedAt: "2026-02-16",
      images: { symbol: "", logo: "" },
    },
    images: {
      small: "/card-placeholder.svg",
      large: "/card-placeholder.svg",
    },
    legalities: { unlimited: "Legal" },
    catalogRecord: {
      kind: "historic",
      sourceName: "Guinness World Records",
      sourceUrl:
        "https://www.guinnessworldrecords.com/world-records/452634-most-expensive-pokemon-trading-card-sold-at-auction",
      verifiedAt: "2026-02-16",
      note: "Historic Japanese contest promo. A licensed catalog provider can supply card imagery and additional print data when configured.",
    },
  },
];

export function getHistoricCard(id: string) {
  return HISTORIC_CARDS.find(card => card.id === id) ?? null;
}

export function searchHistoricCards(query: string, limit = 8) {
  const corrected = correctSearchText(query);
  if (!corrected) return [];
  return HISTORIC_CARDS.map(card => ({
    card,
    score: Math.max(
      searchSimilarity(corrected, card.name),
      searchSimilarity(corrected, `${card.name} ${card.set.name}`),
      corrected.includes("pikachu") && corrected.includes("illustrator") ? 1 : 0
    ),
  }))
    .filter(item => item.score >= 0.58)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.card);
}

export function getHistoricPsaComps(id: string) {
  if (id !== "historic:pikachu-illustrator-1998") return [];
  return [
    {
      grade: 10,
      value: 16_492_000,
      currency: "USD" as const,
      basis: "last_public_auction" as const,
      sourceName: "Guinness World Records / Goldin",
      sourceUrl:
        "https://www.guinnessworldrecords.com/world-records/452634-most-expensive-pokemon-trading-card-sold-at-auction",
      observedAt: "2026-02-16",
      note: "Auction total includes buyer's premium. This is a historic sale, not a live appraisal.",
    },
  ];
}
