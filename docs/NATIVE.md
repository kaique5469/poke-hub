# Native apps (iOS / Android) with Capacitor

The store apps are the same Vite build wrapped by Capacitor. Nothing is
duplicated: the WebView loads `dist/public` from the bundle and calls the
API at `VITE_API_BASE` with a bearer token.

## How auth works in the shell

| Browser | Native shell |
| --- | --- |
| Same-origin `/api/*` | `${VITE_API_BASE}/api/*` + CORS for `capacitor://localhost` / `https://localhost` |
| Session cookie | `Authorization: Bearer <jwt>` (same 365-day JWT) |
| Login returns a cookie | Login with header `X-RG-Client: native` also returns `token`; stored in `localStorage` (`rg.auth.token`) |
| Google OAuth redirects to `?next=` | OAuth opens the system browser with `next=raritygrid://auth`; the callback redirects to `raritygrid://auth?token=…`; the shell stores it (`consumeAuthDeepLink`) |
| Logout clears the cookie | Logout also drops the token |

Server side: `authenticateRequest` reads the cookie or the bearer;
`POST /api/auth/token` exchanges a cookie session for a bearer;
`NATIVE_APP_ORIGINS` (env, comma-separated) lists the allowed WebView
origins.

## One-time setup (on a Mac with Xcode / Android Studio)

```bash
pnpm install
VITE_API_BASE=https://raritygrid.com pnpm build
npx cap add ios
npx cap add android
pnpm cap:sync
```

Then, in the native projects:

- **iOS** (`ios/App/App/Info.plist`): add `NSCameraUsageDescription`
  ("Scan your cards to identify them and see their value") and the URL
  scheme `raritygrid` (CFBundleURLTypes) for the OAuth deep link.
- **Android** (`android/app/src/main/AndroidManifest.xml`): the
  `android.permission.CAMERA` permission and an intent filter for
  `raritygrid://auth` on `MainActivity`.
- Install `@capacitor/app` (deep links) and `@capacitor/splash-screen` as
  needed; the shell already listens for `appUrlOpen` when the plugin exists.

Every release: `pnpm build:native` then `pnpm cap:ios` / `pnpm cap:android`
and archive from Xcode / Android Studio.

## Store notes

- In-app purchases: the web Pro checkout must not be shown inside the iOS
  app for digital goods. Before submitting, gate the paywall behind
  RevenueCat (StoreKit / Play Billing) when `isNative()`; keep the web flow
  for browsers. Until then, the native build should hide the "Get Pro"
  button (see `client/src/app/pro.tsx`).
- The camera uses `getUserMedia` inside WKWebView (iOS 14.3+), no plugin.
