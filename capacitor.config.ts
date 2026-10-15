import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shells for the App Store and Google Play. The WebView loads the
 * Vite build from the bundle and talks to the API at VITE_API_BASE with a
 * bearer token (see client/src/lib/native.ts and docs/NATIVE.md).
 *
 *   pnpm build:native            # VITE_API_BASE=https://raritygrid.com vite build && cap sync
 *   pnpm cap:ios | pnpm cap:android
 *
 * The native projects live in ios/ (Swift Package Manager) and android/.
 */
const APP_BACKGROUND = "#0f0c1a";

const config: CapacitorConfig = {
  appId: "com.raritygrid.app",
  appName: "RarityGrid",
  webDir: "dist/public",
  backgroundColor: APP_BACKGROUND,
  server: {
    // Android serves the bundle from https://localhost so secure-context
    // APIs (camera, service worker) work; iOS uses capacitor://localhost.
    androidScheme: "https",
  },
  ios: {
    contentInset: "never",
    scrollEnabled: true,
    // Keep the WebView under the system bars; the shell pads with
    // env(safe-area-inset-*) itself (viewport-fit=cover).
    preferredContentMode: "mobile",
  },
  android: {
    allowMixedContent: false,
    // Capacitor keeps the WebView out from under the system bars on
    // Android 15+ (edge-to-edge) so the app's own safe-area padding stays
    // correct without a plugin.
    adjustMarginsForEdgeToEdge: "auto",
  },
  plugins: {
    StatusBar: {
      // Dark app chrome → light status-bar text on both platforms.
      style: "DARK",
      backgroundColor: APP_BACKGROUND,
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: APP_BACKGROUND,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: false,
    },
  },
};

export default config;
