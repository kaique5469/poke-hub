/**
 * TCG Arena brand logo — "Arena A" mark.
 * The letter A built from two leaning trading cards with a gold crossbar.
 */
export function ArenaMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="arena-vio" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      {/* left card */}
      <rect x="28" y="10" width="72" height="168" rx="14" fill="url(#arena-vio)" transform="rotate(14 64 94)" />
      {/* right card */}
      <rect x="104" y="10" width="72" height="168" rx="14" fill="#111827" transform="rotate(-14 140 94)" />
      {/* gold crossbar */}
      <rect x="60" y="112" width="82" height="26" rx="10" fill="#F5B301" />
    </svg>
  );
}

export function ArenaWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "hidden sm:block" : ""}>
      <div className="font-black text-lg leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
        <span className="text-gray-900">TCG</span>{" "}
        <span className="text-primary">ARENA</span>
      </div>
      <div className="text-[9px] text-gray-400 leading-none font-semibold tracking-[0.18em] uppercase mt-0.5">
        Trade · Collect · Compete
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
