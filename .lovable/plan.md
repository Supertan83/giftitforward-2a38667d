
## Fix scope
Apply the same real-time status transition in the **All Marketplaces Overview cards** (the screen in your screenshot), so they stop showing stale `upcoming` when the event has already started.

## What I verified
- `useMarketplaces()` already auto-computes status (`upcoming -> active`, `active/upcoming -> completed`) in `src/hooks/useSupabaseData.ts`.
- `useMarketplaceReport()` in `src/hooks/useMarketplaceAllocations.ts` was already updated to compute dynamic status for the selected report header.
- `useAllMarketplaceReports()` in the same file still returns `status: mp.status` (raw DB value), and `MarketplaceReports.tsx` renders this value in the overview cards.
- That mismatch explains why dropdown/header can be correct while overview cards still show `upcoming`.

## Implementation plan
1. **Create one shared status resolver inside `src/hooks/useMarketplaceAllocations.ts`**
   - Add a small helper (local to this file) to compute display status from:
     - `status`
     - `event_date`
     - `start_time`
     - `end_time`
     - `status_locked_by_admin`
   - Rules (same as existing logic):
     - If admin lock is enabled: keep DB status.
     - Else if now > event end: `completed`.
     - Else if status is `upcoming` and now >= event start: `active`.
     - Else keep original status.
   - Keep same defaults:
     - start fallback: `00:00`
     - end fallback: `23:59:59.999`

2. **Use this helper in `useMarketplaceReport()`**
   - Replace inline IIFE status computation with helper call.
   - This keeps selected header behavior unchanged but removes duplication.

3. **Use this helper in `useAllMarketplaceReports()`**
   - Replace `status: mp.status` with computed status from helper.
   - This is the key fix for the card list in your screenshot.

4. **No backend/schema changes**
   - This is display-layer computation only.
   - No migration, no table changes, no policy changes.

## Validation checklist
- Open Marketplace Reports with no selected marketplace:
  - Confirm the started event card now shows `active` (not `upcoming`).
- Select that same marketplace:
  - Confirm header status matches the card status.
- Check an event with end time passed:
  - Confirms `completed`.
- Check an event manually locked by admin:
  - Confirms status remains exactly as set manually.
- Quick regression:
  - Dropdown, overview cards, and selected header all show consistent status.

## Notes / edge case
- This logic uses client local time (same pattern used elsewhere in your app).  
- If you ever want strict UAE-time behavior regardless of viewer timezone, I can plan a timezone-pinned version as a follow-up.
