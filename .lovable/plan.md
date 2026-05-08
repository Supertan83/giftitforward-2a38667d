# Bulk Distribute in Allocate Items

Currently in **Admin → Allocate Items**, marking items as distributed requires clicking the paper-plane icon row by row, which is painful for marketplaces with 98+ listings or 11k+ units.

## What I'll add

In `src/components/admin/AllocationManagement.tsx`, on top of the allocations table for the selected marketplace:

1. **Row checkboxes + a "select all" checkbox** in the table header.
2. A **bulk action bar** that appears above the table when the marketplace has allocations, showing:
   - `Selected: X / 98` (or `All` when select-all is on)
   - Button **"Distribute Remaining (selected)"** — sets `distributed_quantity = allocated_quantity` for each selected row that still has remaining > 0.
   - Button **"Distribute All Remaining"** — same, but for every row in the current marketplace (one click, no selection needed).
3. A **confirmation dialog** before running the bulk action, showing counts:
   - e.g. *"This will mark 10,985 units across 98 items as distributed for Stronger Together Emirati Family Community Marketplace February 21. Continue?"*
4. **Progress + result toast** ("Distributed 10,985 units across 98 items. 0 failed.").
5. Rows already fully distributed are skipped silently.

## Technical details

- Reuse the existing `updateAllocationQuantities` mutation from `useMarketplaceAllocations` — it already takes `{ id, allocatedQuantity, distributedQuantity }`. For each target row we call it with `distributedQuantity = allocatedQuantity` (allocated stays the same).
- Run the mutations with bounded concurrency (e.g. `Promise.all` in chunks of 8) to stay responsive without hammering the DB.
- After completion: invalidate the allocations query (mutation already does this) and write one `traceability_logs` entry summarising the bulk action (action `bulk_distributed`, with count + total units).
- No changes to the database, RLS, edge functions, or to the per-row Send button.
- No change to Surpluss reporting — that remains a separate explicit step (the existing "Report Distribution" flow in `useSurplussDistributionReporting` keeps working unchanged, using the new `distributed_quantity` values).

## Out of scope

- Bulk *undo* / *reallocate* — only **Distribute** is requested.
- Cross-marketplace bulk actions.
- Changes to the Surpluss sync button.
