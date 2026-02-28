
## Diagnosis (why you still see old cache)

I traced the cache/version logic and found a concrete bug causing stale builds to persist:

1. In `src/main.tsx`, the version is currently set as:
   - `const CURRENT_VERSION = "__BUILD_TIMESTAMP__";`
2. In `vite.config.ts`, `__BUILD_TIMESTAMP__` is provided via Vite `define`, which only replaces identifiers, not quoted strings.
3. Because it is quoted, the app stores the literal `"__BUILD_TIMESTAMP__"` in local storage as the cache version.
4. On future deploys, the comparison is still against the same literal string, so migration does **not** trigger again.
5. That explains why users can remain on old cached assets even after fixes are deployed.

The console snapshot (`[vite] server connection lost. Polling for restart...`) is also consistent with stale service-worker control in preview sessions.

## Implementation plan

### 1) Fix the version token so it actually changes per build
**File:** `src/main.tsx`

- Change:
  - from: `const CURRENT_VERSION = "__BUILD_TIMESTAMP__";`
  - to: `const CURRENT_VERSION = __BUILD_TIMESTAMP__;`
- This makes the build timestamp truly dynamic and allows version mismatch detection to work as intended.

### 2) Add legacy-token recovery for already-affected users
**File:** `src/main.tsx`

- During migration, treat stored `"__BUILD_TIMESTAMP__"` as a stale/legacy value and force cleanup.
- This ensures users who already saved the broken literal version get unstuck on next load after deployment.

### 3) Make the post-cleanup reload cache-busting
**File:** `src/main.tsx`

- After unregistering workers and deleting caches, reload using a versioned URL (query param with current version), then optionally clean the param after boot.
- This reduces the chance of one more stale `index.html` response during the transition.

### 4) Prevent preview environment from being trapped by PWA caching
**File:** `src/main.tsx`

- Gate service-worker registration for preview hosts (e.g. preview subdomains / lovableproject domain), while keeping registration for published production host.
- Keep existing aggressive update behavior for real production users.

### 5) Keep existing update strategy intact
**File:** `src/main.tsx` (no behavior loss)

- Retain:
  - `onNeedRefresh -> updateSW(true)`
  - periodic `registration.update()`
  - offline-ready logging
- Only harden version detection + migration path.

## Validation checklist

1. Open preview after deployment:
   - First load should trigger one-time cache reset for affected users.
2. Confirm localStorage key `app-cache-version` is now a real timestamp string, not `"__BUILD_TIMESTAMP__"`.
3. Confirm latest UI/data logic appears immediately (including recently fixed marketplace status displays).
4. Reload again:
   - No repeated forced cleanup loop.
5. Verify published app still registers PWA and updates correctly.

## Expected outcome

- Users currently stuck on old cached bundles are automatically recovered.
- Future deploys invalidate correctly by build version.
- Preview/testing becomes much less likely to appear “stuck on old cache.”
