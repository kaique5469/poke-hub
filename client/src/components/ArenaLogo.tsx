/** RarityGrid brand mark. Export names remain stable for existing imports. */
export function ArenaMark({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rarity-grid" x1="9" y1="8" x2="55" y2="56">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="#0F172A" />
      <rect
        x="10"
        y="10"
        width="20"
        height="20"
        rx="5"
        fill="url(#rarity-grid)"
      />
      <rect x="34" y="10" width="20" height="20" rx="5" fill="#F5B301" />
      <rect x="10" y="34" width="20" height="20" rx="5" fill="#F5B301" />
      <rect
        x="34"
        y="34"
        width="20"
        height="20"
        rx="5"
        fill="url(#rarity-grid)"
      />
    </svg>
  );
}

export function ArenaWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "hidden sm:block" : ""}>
      <div
        className="font-black text-lg leading-none tracking-tight"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <span className="text-gray-900">RARITY</span>
        <span className="text-primary">GRID</span>
      </div>
      <div className="text-[9px] text-gray-400 leading-none font-semibold tracking-[0.18em] uppercase mt-0.5">
        Buy · Sell · Track
      </div>
    </div>
  );
}

export default function ArenaLogo({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <ArenaMark size={size} />
      <ArenaWordmark compact />
    </span>
  );
}
