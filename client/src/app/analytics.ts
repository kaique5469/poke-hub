/**
 * Product analytics for the app shell.
 *
 * Events are the activation funnel the launch is measured on:
 *   app_open → scan_started → scan_success | scan_failed → card_collected
 *   → signup_prompt_viewed → signup → pending_merged
 *   → paywall_viewed → paywall_converted (later)
 *
 * Sink: PostHog when `window.posthog` is present (load it from index.html
 * with VITE_POSTHOG_KEY when ready); otherwise a console line in dev and a
 * no-op in production. No PII is ever attached — only ids and counts.
 */

type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    posthog?: { capture: (event: string, props?: Props) => void };
  }
}

const SESSION_KEY = "rg.app.session";

function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "nostorage";
  }
}

export function track(event: string, props: Props = {}) {
  const payload = { ...props, app: "mobile-shell", session: sessionId() };
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture(event, payload);
    return;
  }
  if (import.meta.env.DEV) {
    console.debug(`[track] ${event}`, payload);
  }
}
