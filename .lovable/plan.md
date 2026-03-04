

# Fix All Allocation Discrepancies — Full Audit & Correction Plan

## Current State (Live Data)

| Metric | Value |
|--------|-------|
| Total items with external IDs | 427 |
| Items with over-allocation flags | **135 (31.6%)** |
| Grand total `total_stock` | 100,015 |
| Grand total `allocated_quantity` | **205,608** (2x stock) |
| Grand total `distributed_quantity` | 40,762 |
| Items with corrupted distributed > allocated | 1 (Cosmetics #872: 22,144 distributed vs 300 allocated) |

**Worst offenders:** Baby diapers #610 (over by 13,593), Women's Undergarments #866 (over by 6,295), Storage containers #782 (over by 5,755).

The Feb 21 marketplace alone has 127,088 units allocated with 0 distributed — these are planning targets from Surpluss that far exceed physical stock.

## Root Causes

1. **`total_stock`** is set from `donation.quantity` (Surpluss "remaining unallocated") — not the total allocated to GIF
2. **`allocated_quantity`** comes from the Surpluss `donation-allocations` endpoint which returns cumulative planning targets per event, not capped to physical stock
3. **No validation** prevents allocations exceeding stock
4. **One corrupted record**: Cosmetics #872 has 22,144 distributed (should be ~300 max)

## Plan

### 1. Create `fix-allocation-data` Edge Function
A maintenance function that:
- Recalculates `total_stock` for each item using the **sum of all marketplace allocations** as the true "allocated to GIF" quantity (since Surpluss allocation targets represent what was assigned to GIF events)
- Fixes the Cosmetics #872 corruption (cap `distributed_quantity` to `allocated_quantity`)
- Logs every change to `allocation_traceability_logs`
- Returns a before/after report
- Accepts optional `dry_run` flag to preview changes without applying them

### 2. Add `stock_locked` Column to `item_types`
Database migration adding a boolean `stock_locked` column (default `false`). When `true`, the `sync-surpluss-allocations` function will skip overwriting `total_stock` for that item.

### 3. Update `sync-surpluss-allocations` to Respect Lock
After fix is applied, items corrected by the fix function get `stock_locked = true`. Future syncs will skip updating their `total_stock`, preserving the corrected values.

### 4. Add Admin UI: "Fix Allocations" Button
In the existing Material Lookup panel, add a "Run Allocation Fix" button that:
- First runs in `dry_run` mode showing a summary of proposed changes
- On confirmation, runs the actual fix
- Shows before/after results

## Files Changed
1. **New**: `supabase/functions/fix-allocation-data/index.ts`
2. **Migration**: Add `stock_locked` boolean to `item_types`
3. **Edit**: `supabase/functions/sync-surpluss-allocations/index.ts` — skip locked items
4. **Edit**: `src/components/admin/MaterialBreakdownLookup.tsx` — add fix button + dry-run preview
5. **Edit**: `supabase/config.toml` — register new function

