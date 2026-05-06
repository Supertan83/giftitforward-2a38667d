# Fix: Delete button on Inactive volunteers does nothing visible

## Root cause

When the delete button is clicked on an "Inactive" row in `MarketplaceReports.tsx`, the handler `handleConfirmDelete` correctly soft-deletes the row by setting `deleted_at` on:

- `volunteer_qr_cards` (when there is a QR card — which is the case for every row in the screenshot, the QR icon proves it), and
- `volunteer_attendance`

However, the queries that build the volunteer list in `useMarketplaceAllocations.ts` do **not** filter out soft-deleted rows:

```ts
// src/hooks/useMarketplaceAllocations.ts (~line 603 and ~line 654)
supabase.from('volunteer_attendance')
  .select('..., volunteer_qr_cards(...)')
  .eq('marketplace_id', marketplaceId);          // ← missing .is('deleted_at', null)

supabase.from('volunteer_qr_cards')
  .select('...')
  .eq('marketplace_id', marketplaceId);          // ← missing .is('deleted_at', null)
```

Per the project-wide soft-delete rule, every read must filter `deleted_at IS NULL`. Because that filter is missing, the deleted card immediately reappears in the list after the React Query cache invalidation re-runs the same query → from the user's perspective the delete button "does nothing".

The toast even fires successfully (the DB update works), but the UI never reflects it.

## Fix

In `src/hooks/useMarketplaceAllocations.ts`, add `.is('deleted_at', null)` to both fetches that feed the per-marketplace volunteer list:

1. `volunteer_attendance` query (~line 603-606) — also ignore attendance rows whose parent card has been soft-deleted.
2. `volunteer_qr_cards` query for `assignedCards` (~line 654-657).

After the fix, soft-deleting a card or attendance row will correctly remove the row from the report on the next re-render (queries are already invalidated by `handleConfirmDelete`).

## Out of scope

- The "Active" / form-registered (no card) deletion path already works (it strips the marketplace from `events_json` and that read is performed elsewhere).
- No schema or RLS changes are required.
- No UI changes are required.
