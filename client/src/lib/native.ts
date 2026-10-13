/**
 * Native-app plumbing (Capacitor). In the browser every helper here is a
 * no-op: the API is same-origin and the session lives in a cookie. Inside
 * the Capacitor WebView the bundle is served from capacitor://localhost, so
 * requests go to API_BASE with a bearer token instead.
 *
 * VITE_API_BASE is set only for native builds (e.g. https://raritygrid.com).
 */

const TOKEN_KEY = "rg.auth.token";

export const API_BASE: string = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.()) || API_BASE !== "";
}

/** Absolute URL for an API path; same-origin in the browser. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** Headers every API request carries in the native shell. */
export function authHeaders(): Record<string, string> {
  if (!isNative()) return {};
  const headers: Record<string, string> = { "X-RG-Client": "native" };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * The OAuth deep link lands as raritygrid://auth?token=…; Capacitor's App
 * plugin delivers it as an appUrlOpen event. Call this with the URL.
 */
export function consumeAuthDeepLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token");
    if (!token) return false;
    setAuthToken(token);
    return true;
  } catch {
    return false;
  }
}
