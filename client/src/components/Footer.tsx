import { Link } from "wouter";
import { ArenaMark } from "@/components/ArenaLogo";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <ArenaMark size={30} />
              <span
                className="font-black text-lg text-white"
                style={{ fontFamily: "Nunito, sans-serif" }}
              >
                TCG&nbsp;ARENA
              </span>
            </div>
            <p
              className="text-xs leading-relaxed mb-4"
              style={{ color: "oklch(0.62 0.01 240)" }}
            >
              Trade. Collect. Compete. The card game marketplace where
              collectors compete.
            </p>
            <Link href="/contact" className="footer-link">
              Contact support
            </Link>
          </div>

          {/* Cards */}
          <div>
            <p className="footer-title">Cards</p>
            <Link href="/cards" className="footer-link">
              Card Database
            </Link>
            <Link href="/sets" className="footer-link">
              TCG Sets
            </Link>
            <Link href="/market" className="footer-link">
              Market Pulse
            </Link>
            <Link href="/cards" className="footer-link">
              New Releases
            </Link>
          </div>

          {/* Pokédex */}
          <div>
            <p className="footer-title">Pokédex</p>
            <Link href="/pokedex" className="footer-link">
              All Pokémon
            </Link>
            <Link href="/pokedex?gen=1" className="footer-link">
              Generation I
            </Link>
            <Link href="/pokedex?gen=9" className="footer-link">
              Generation IX
            </Link>
            <Link href="/pokedex?type=dragon" className="footer-link">
              Dragon Types
            </Link>
          </div>

          {/* Marketplace */}
          <div>
            <p className="footer-title">Marketplace</p>
            <Link href="/shop?cat=booster_box" className="footer-link">
              Booster Boxes
            </Link>
            <Link href="/shop?cat=etb" className="footer-link">
              Elite Trainer Boxes
            </Link>
            <Link href="/cards" className="footer-link">
              Singles
            </Link>
            <Link href="/shop?cat=booster_bundle" className="footer-link">
              Booster Bundles
            </Link>
          </div>

          {/* Community */}
          <div>
            <p className="footer-title">Community</p>
            <Link href="/metagame" className="footer-link">
              Metagame
            </Link>
            <Link href="/deck-builder" className="footer-link">
              Deck Builder
            </Link>
            <Link href="/tournaments" className="footer-link">
              Tournaments
            </Link>
            <Link href="/community" className="footer-link">
              Community Feed
            </Link>
            <Link href="/drops" className="footer-link">
              Drop Alerts
            </Link>
          </div>
        </div>

        <div
          className="border-t pt-6"
          style={{ borderColor: "oklch(0.28 0.02 240)" }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <p
              className="text-xs text-center md:text-left"
              style={{ color: "oklch(0.52 0.015 240)" }}
            >
              © 2026 TCG Arena. Pokémon and all related names are trademarks of
              Nintendo, Game Freak & Creatures Inc. This site is not affiliated
              with or endorsed by The Pokémon Company.
            </p>
            <div
              className="flex gap-4 text-xs"
              style={{ color: "oklch(0.52 0.015 240)" }}
            >
              <Link
                href="/privacy"
                className="hover:text-white transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="hover:text-white transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/contact"
                className="hover:text-white transition-colors"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
