import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shells for the App Store and Google Play. The WebView loads the
 * Vite build from the bundle and talks to the API at VITE_API_BASE with a
 * bearer token (see client/src/lib/native.ts and docs/NATIVE.md).
 *
 *   VITE_API_BASE=https://raritygrid.com pnpm build && pnpm cap:sync
 */
const config: CapacitorConfig = {
  appId: "com.raritygrid.app",
  appName: "RarityGrid",
  webDir: "dist/public",
  backgroundColor: "#0f0c1a",
  server: {
    // Android serves the bundle from https://localhost so secure-context
    // APIs (camera, service worker) work; iOS uses capacitor://localhost.
    androidScheme: "https",
  },
  ios: {
    contentInset: "never",
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
