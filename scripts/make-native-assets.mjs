/**
 * Renders the native icon + splash sources in assets/ from the RarityGrid
 * mark (same geometry as client/public/favicon.svg), then
 * `npx capacitor-assets generate` turns them into every iOS/Android size.
 *
 *   node scripts/make-native-assets.mjs && pnpm native:assets
 */
import { createRequire } from "node:module";

// sharp ships with @capacitor/assets; resolve it from there (pnpm keeps it unhoisted).
const requireFromAssets = createRequire(createRequire(import.meta.url).resolve("@capacitor/assets/package.json"));
const sharp = requireFromAssets("sharp");
const BG = "#0f0c1a";      // app background (splash)
const ICON_BG = "#0f172a"; // logo tile background
const grid = (s, inset) => {
  // Four rounded squares, same proportions as favicon.svg (10..54 of 64).
  const u = (s * (1 - 2 * inset)) / 64; const o = s * inset;
  const r = 5 * u, w = 20 * u;
  const sq = (x, y, fill) => `<rect x="${o + x * u}" y="${o + y * u}" width="${w}" height="${w}" rx="${r}" fill="${fill}"/>`;
  return `<defs><linearGradient id="g" x1="${o + 8 * u}" y1="${o + 6 * u}" x2="${o + 57 * u}" y2="${o + 58 * u}" gradientUnits="userSpaceOnUse"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#5b21b6"/></linearGradient></defs>` +
    sq(10, 10, "url(#g)") + sq(34, 10, "#f5b301") + sq(10, 34, "#f5b301") + sq(34, 34, "url(#g)");
};
const svg = (s, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${bg ? `<rect width="${s}" height="${s}" fill="${bg}"/>` : ""}${body}</svg>`;

const out = async (name, s) => { await sharp(Buffer.from(s)).png().toFile(`assets/${name}`); console.log("wrote", name); };

// iOS/Android legacy icon: full-bleed tile (the OS applies its own mask).
await out("icon-only.png", svg(1024, grid(1024, 0.10), ICON_BG));
// Android adaptive icon layers (foreground keeps the safe zone: ~66% center).
await out("icon-foreground.png", svg(1024, grid(1024, 0.24), null));
await out("icon-background.png", svg(1024, "", ICON_BG));
// Splash: centered logo on the app background, both light and dark.
const splash = svg(2732, `<g transform="translate(${(2732 - 560) / 2} ${(2732 - 560) / 2})">${svg(560, grid(560, 0.0), null).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>`, BG);
await out("splash.png", splash);
await out("splash-dark.png", splash);
