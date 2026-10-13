/**
 * Product analytics for the app shell.
 *
 * Events are the activation funnel the launch is measured on:
 *   app_open → scan_started → scan_success | scan_failed → card_collected
 *   → signup_prompt_clicked → signup → pending_merged
 *   → paywall_viewed → paywall_checkout_started → paywall_converted
 *
 * Sink: PostHog when VITE_POSTHOG_KEY is set at build time (loaded lazily so
 * the bundle pays nothing otherwise); a console line in dev; a no-op in
 * production without a key. No PII is attached — ids, counts and flags only.
 */

type Props = Record<string, string | number | boolean | null | undefined>;

type PostHogLike = {
  init: (key: string, options: Record<string, unknown>) => void;
  capture: (event: string, props?: Props) => void;
  identify: (id: string, props?: Props) => void;
  reset: () => void;
};

const KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? "";
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";
const SESSION_KEY = "rg.app.session";

let client: PostHogLike | null = null;
let loading: Promise<PostHogLike | null> | null = null;
const queue: Array<[string, Props]> = [];

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

function load(): Promise<PostHogLike | null> {
  if (!KEY || typeof window === "undefined") return Promise.resolve(null);
  if (client) return Promise.resolve(client);
  loading ??= import("posthog-js")
    .then(mod => {
      const ph = mod.default as unknown as PostHogLike;
      ph.init(KEY, {
        api_host: HOST,
        capture_pageview: false,
        capture_pageleave: true,
        persistence: "localStorage+cookie",
        autocapture: false,
        disable_session_recording: true,
      });
      client = ph;
      for (const [event, props] of queue.splice(0)) ph.capture(event, props);
      return ph;
    })
    .catch(() => null);
  return loading;
}

export function track(event: string, props: Props = {}) {
  const payload = { ...props, app: "mobile-shell", session: sessionId() };
  if (KEY) {
    if (client) client.capture(event, payload);
    else {
      queue.push([event, payload]);
      void load();
    }
    return;
  }
  if (import.meta.env.DEV) {
    console.debug(`[track] ${event}`, payload);
  }
}

/** Ties events to the account id (never email or name). */
export function identify(userId: number | null) {
  if (!KEY) return;
  void load().then(ph => {
    if (!ph) return;
    if (userId == null) ph.reset();
    else ph.identify(`user_${userId}`);
  });
}
