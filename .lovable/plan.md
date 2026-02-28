
Goal: make your published app always move to the newest build quickly after each publish, and stop “months-old cached version” behavior.

What I found in your codebase
1. You already use the PWA plugin in `vite.config.ts`.
2. Your app entry (`src/main.tsx`) does not explicitly manage service worker updates.
3. The generated published `registerSW.js` currently only does basic registration:
   - `navigator.serviceWorker.register('/sw.js')`
   - no periodic update checks
   - no forced refresh when a new worker is waiting
This is the main reason users can remain stuck on an older cached app shell.

Implementation plan

1) Strengthen PWA cache/update strategy in `vite.config.ts`
- Keep PWA enabled, but make update behavior explicit and aggressive:
  - `injectRegister: false` (we will handle registration in app code)
  - `registerType: "autoUpdate"`
  - `workbox.skipWaiting = true`
  - `workbox.clientsClaim = true`
  - `workbox.cleanupOutdatedCaches = true`
- Add a publish-level cache namespace/version so each publish rotates cache identity (cache-bust by release):
  - e.g. `workbox.cacheId` based on build timestamp/version string.
- Keep runtime caching only for safe static externals (fonts), and avoid overly sticky app-shell behavior.

2) Add explicit service-worker lifecycle control in `src/main.tsx`
- Import and use `registerSW` from `virtual:pwa-register`.
- Register with `immediate: true`.
- On registration:
  - trigger `registration.update()` immediately,
  - then run periodic update checks (e.g. every 60s).
- On `onNeedRefresh`:
  - activate new worker and reload automatically (`updateSW(true)` + reload) so users switch immediately.
- Add `onRegisterError` logging for easier diagnosis.

3) Add one-time stale-cache migration guard (for existing stuck users)
- On first load of the new release, run a controlled “legacy cache cleanup” marker flow:
  - unregister old service workers,
  - clear old Workbox caches,
  - set a local marker so this runs only once,
  - reload app.
This specifically addresses your “very old, maybe 2 months” stuck clients.

4) Validation checklist after implementation
- Publish once, open app in a fresh tab → verify latest UI loads.
- Publish a second small change → verify app updates within ~1 minute without manual hard refresh.
- Verify `sw.js`/cache namespace changes between publishes.
- Verify no regression in login/session behavior after cache migration.
- Confirm update behavior both on desktop browser and mobile browser/PWA install.

Important note about editor preview vs published app
- This plan fixes app-level stale service-worker caching (especially on published URL).
- The editor’s “live preview starts after chat action” behavior is platform-side build triggering and is separate from your app code.
- So after this fix, published app freshness improves significantly; editor preview trigger timing may still behave as before.

Files to update
- `vite.config.ts`
- `src/main.tsx`

Expected outcome
- After each publish, users are moved to the newest build much faster.
- Old service-worker cache lock-in is broken.
- “Very old cached version” incidents are eliminated or reduced to a short update window.
