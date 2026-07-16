const STORAGE_KEY = "tcg-arena-market-session";

export function getMarketSessionId() {
  if (typeof window === "undefined") return "server-session";
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing && existing.length >= 8) return existing;
  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `market-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(STORAGE_KEY, created);
  return created;
}
