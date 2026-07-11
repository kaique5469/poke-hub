/**
 * Official Pokémon type symbols (Sword/Shield glyphs) inside colored circles.
 * Glyph SVGs served from jsdelivr (duiker101/pokemon-type-svg-icons);
 * falls back to the type's first letter if the asset fails to load.
 */
import { useState } from "react";

const GLYPH_CDN = "https://cdn.jsdelivr.net/gh/duiker101/pokemon-type-svg-icons@master/icons";

export const TYPE_COLOR: Record<string, string> = {
  normal: "#A8A878",
  fire: "#F08030",
  water: "#6890F0",
  electric: "#F8D030",
  grass: "#78C850",
  ice: "#98D8D8",
  fighting: "#C03028",
  poison: "#A040A0",
  ground: "#E0C068",
  flying: "#A890F0",
  psychic: "#F85888",
  bug: "#A8B820",
  rock: "#B8A038",
  ghost: "#705898",
  dragon: "#7038F8",
  dark: "#705848",
  steel: "#B8B8D0",
  fairy: "#EE99AC",
};

/** Colored circle with the official white type glyph inside. */
export function TypeIcon({ type, size = 24, title }: { type: string; size?: number; title?: string }) {
  const [failed, setFailed] = useState(false);
  const color = TYPE_COLOR[type] ?? "#9CA3AF";
  const glyph = Math.round(size * 0.55);
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: color, boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.15)" }}
      title={title ?? type.charAt(0).toUpperCase() + type.slice(1)}
    >
      {!failed ? (
        <img
          src={`${GLYPH_CDN}/${type}.svg`}
          alt=""
          width={glyph}
          height={glyph}
          loading="lazy"
          style={{ filter: "brightness(0) invert(1)", display: "block" }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-white font-black" style={{ fontSize: size * 0.5, lineHeight: 1 }}>
          {type.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
