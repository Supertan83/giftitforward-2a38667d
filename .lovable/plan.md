

## Scale, Load, and Operational Stress -- Analysis and Fixes

### Current State Assessment

After reviewing the scanning pipeline end-to-end (QRScanner -> Zone handler -> RPC -> Feedback), here are the findings:

---

### 1. Rapid Scans -- MOSTLY SAFE, one risk

**What's good:**
- The `isProcessingRef` lock in QRScanner prevents double-fires from a single scan
- The 2-second cooldown with auto-close prevents accidental re-scans
- Backend RPCs are atomic single-transaction operations (~200ms latency)
- The scanner stops the camera immediately after reading a code

**Risk found -- Feedback Overlay blocks the next scan:**
The `FeedbackOverlay` uses a fixed timeout (1.5s success, 3s warning, 3.5s error) during which the entire screen is covered. The volunteer CANNOT open the scanner again until the overlay dismisses. Under high throughput, this dead time adds up significantly.

**Fix:** Add a "tap to dismiss" capability to the FeedbackOverlay so volunteers can skip the animation and immediately start the next scan.

---

### 2. One Volunteer Managing Multiple Beneficiaries -- SAFE

**What's good:**
- Each scan is stateless from the volunteer's perspective -- scan, process, done
- No session state ties a volunteer to a specific beneficiary
- The atomic RPCs handle all validation server-side (card status, credit limits)

**No fix needed** -- the architecture already supports this pattern well.

---

### 3. Known Failure Points Under Load -- TWO ISSUES

**Issue A: Full QR card list fetched on every invalidation**
`useQRCards()` fetches ALL cards (paginated in 1000-row batches) and subscribes to realtime changes on the entire `qr_cards` table. Every scan by ANY volunteer triggers `invalidateQueries(['qr_cards'])`, causing every connected device to re-fetch potentially thousands of cards. With 10+ tablets scanning simultaneously, this creates a cascade of heavy queries.

**Fix:** The Entrance Zone is the only zone that uses `useQRCards()` for stats. The Marketplace Zone does NOT need it -- it only uses RPCs. So the fix is:
- Remove the realtime subscription from `useQRCards()` to prevent cascade re-fetches
- Use a longer `staleTime` (e.g., 30s) so stats refresh less aggressively
- The Marketplace Zone already correctly avoids this hook

**Issue B: No offline/retry handling for network drops**
Field conditions may have intermittent connectivity. Currently, if a scan's RPC call fails due to network timeout, the volunteer sees "Action Failed" with a generic message and must re-scan. There's no automatic retry.

**Fix:** Add retry logic (1 retry with 2s delay) to the distribute/return mutations so transient network failures self-heal without volunteer intervention.

---

### 4. Safeguards for High-Throughput -- ONE ADDITION

**Missing safeguard: No duplicate scan protection at the application level**
If the same card is scanned twice rapidly (e.g., volunteer accidentally taps scanner twice before cooldown kicks in), the backend handles it correctly (atomic RPC increments balance). But the volunteer sees two success overlays for what they intended as one action.

**Fix:** Add a "last scanned card + timestamp" check in the zone handlers. If the same card ID is scanned within 5 seconds, show a warning instead of processing again.

---

### Implementation Plan

**File 1: `src/components/FeedbackOverlay.tsx`**
- Add `onClick` handler to the overlay container that calls `onComplete()` immediately
- Add a small "Tap to dismiss" hint text at the bottom

**File 2: `src/components/zones/MarketplaceZone.tsx`**
- Add `lastScanRef` (stores `{code, timestamp}`) to prevent duplicate scans within 5 seconds
- Add retry logic: wrap RPC calls in a try-catch that retries once on network errors
- Show "Already scanned" warning if same card scanned within 5s

**File 3: `src/components/zones/EntranceZone.tsx`**
- Same duplicate scan protection as MarketplaceZone
- Same retry logic for the `activateCard` mutation

**File 4: `src/hooks/useSupabaseData.ts`**
- Add `staleTime: 30000` to `useQRCards` query to reduce re-fetch frequency
- Add `retry: 1` to distribute/return mutations for transient failure recovery

### Summary of Changes

| Area | Risk Level | Fix |
|---|---|---|
| Feedback overlay blocks next scan | Medium | Tap to dismiss |
| QR card list re-fetched on every scan | High under load | Add staleTime, reduce realtime cascade |
| No network retry | Medium | Add 1 retry to mutations |
| Duplicate rapid scans | Low | 5-second same-card guard |

