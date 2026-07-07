/**
 * Card-condition pill in Liga Pokémon style:
 * M (gold), NM (green), SP (teal), MP (yellow), HP (orange), D (red).
 */
export const CONDITIONS = ["M", "NM", "SP", "MP", "HP", "D"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  M: "Mint",
  NM: "Near Mint",
  SP: "Slightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  D: "Damaged",
};

const STYLES: Record<Condition, { bg: string; fg: string }> = {
  M: { bg: "#FEF3C7", fg: "#92400E" },
  NM: { bg: "#D1FAE5", fg: "#065F46" },
  SP: { bg: "#CCFBF1", fg: "#115E59" },
  MP: { bg: "#FEF9C3", fg: "#854D0E" },
  HP: { bg: "#FFEDD5", fg: "#9A3412" },
  D: { bg: "#FEE2E2", fg: "#991B1B" },
};

export function ConditionPill({ condition, showLabel = false }: { condition: string | null | undefined; showLabel?: boolean }) {
  const c = condition && (CONDITIONS as readonly string[]).includes(condition) ? (condition as Condition) : "NM";
  const s = STYLES[c];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
      title={CONDITION_LABELS[c]}
    >
      {showLabel ? CONDITION_LABELS[c] : c}
    </span>
  );
}
