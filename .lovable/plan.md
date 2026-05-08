# Fix: "Sync to Surpluss" fails with "non-2xx status code" on All Events

## Root cause

In `src/components/admin/PendingVolunteers.tsx` (lines 1410–1434), the **Sync to Surpluss** button calls `sync-surpluss-volunteer-beneficiary` with an empty body when `eventFilter === 'all'`. The edge function then walks **every** marketplace, every volunteer, every family member and every hours record in one request. That exceeds the Supabase Edge Function ~150s wall-clock / CPU limit, the worker is killed, and the client sees a generic non-2xx error. Single-event syncs work because they finish in time.

## Fix (frontend only — no edge function changes needed)

Change the button handler so that, in "All Events" mode, the client iterates marketplaces and calls the edge function **once per marketplace**, aggregating the results before showing the dialog. Each per-marketplace call stays well within the timeout, and we get a clean per-event progress indicator.

### Changes in `src/components/admin/PendingVolunteers.tsx`

1. Replace the current `onClick` for the **Sync to Surpluss** button (~lines 1413–1434) with a loop:
   - If `eventFilter !== 'all'` → keep current single-call behaviour.
   - If `eventFilter === 'all'` → loop over `marketplaces`, calling `supabase.functions.invoke('sync-surpluss-volunteer-beneficiary', { body: { environment: 'production', marketplace_id: m.id } })` sequentially.
   - Aggregate counters (volunteers_sent / failed / skipped / bulk_updated / attached_to_event, beneficiaries, demographics, family, errors[]) into a single combined result shaped like the existing `setSyncResult(data)` payload.
   - Catch per-marketplace errors and push them into `errors[]` plus `volunteer_details`/`beneficiary_details` with `status: 'failed'` and the marketplace name, so the run continues even if one event fails.
   - Track progress in local state (`syncProgress: { current, total, marketplaceName }`) and show it inside the existing button label, e.g. `Syncing 3/12 — Eid Marketplace…`.

2. Show the existing `SyncResultDialog` once the loop completes with the combined result.

3. No backend, schema, RLS, or edge function changes.

## Verification

- With **All Events** selected: click Sync to Surpluss → button shows progress per marketplace → dialog opens with combined totals; no "non-2xx" toast.
- With **a specific event** selected: behaviour unchanged (one call, one result).
- Force one marketplace's call to throw (e.g. temporarily bad payload) → the loop continues and the failed marketplace is listed in the result dialog under errors.

## Optional follow-ups (not part of this fix)

- Same loop pattern can be applied to the **Sync Beneficiaries** button (lines 1444–1466) once we confirm it shows the same symptom on very large datasets.
- Long-term, move the multi-marketplace loop to a queued background job so admins don't have to keep the tab open.
