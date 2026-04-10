
Issue confirmed

- The Sync Monitor button calls `sync-surpluss-event-allocations`, not `allocate-donations-to-marketplace`.
  - `src/components/admin/SurplussSyncMonitor.tsx:200,228`
- The earlier duplicate-material fix exists in `supabase/functions/allocate-donations-to-marketplace/index.ts`, but `sync-surpluss-event-allocations` still has the old overwrite behavior.
  - `supabase/functions/sync-surpluss-event-allocations/index.ts:340-399`
- That function loops through each `allocated_materials` entry and updates the same marketplace allocation row repeatedly. If the same material appears twice, the last amount wins instead of the summed total.

Why it shows 37k+ for 1 second, then drops

- The marketplace starts from the corrected totals.
- During sync, rows are updated one by one.
- The UI listens to realtime changes on `marketplace_item_allocations` and refetches on every update (`src/hooks/useMarketplaceAllocations.ts:195-205`), so you briefly see intermediate totals before the final bad overwrite settles back to `36,662`.

Plan

1. Fix `supabase/functions/sync-surpluss-event-allocations/index.ts`
   - Add the same aggregation logic already used in `allocate-donations-to-marketplace`.
   - Build a per-marketplace material map before calling `syncMaterial`.
   - Sum duplicate `material_id` / `donation_metadata_id` entries.
   - Aggregate both allocated and distributed amounts.
   - Preserve title/category/subcategory and keep `surpluss_allocation_id` on the final upsert.

2. Align all sync entry points
   - Sync Monitor, Allocation Management, and scheduled auto-sync all use `sync-surpluss-event-allocations`, so fixing this one function will stop manual and automatic resyncs from undoing the totals.
   - If needed, factor the shared aggregation logic so the two allocation-sync functions cannot drift again.

3. Re-run the sync after the fix
   - Re-sync Construction Morning specifically first.
   - Confirm the duplicate-material rows stay at the summed values and the marketplace total remains `37,225`.

4. Verify end to end
   - Check the database total for event `33` / marketplace `6ed111b0-f003-46e8-a719-d76cc1800431`.
   - Confirm the UI no longer drops from `37k+` to `36,662`.
   - Confirm a later scheduled sync also keeps the correct total.

Technical details

- No database schema or RLS changes are needed.
- The bug is in the sync function, not the display layer.
- The previous fix was applied to a different edge function than the one used by the Sync Monitor flow.
