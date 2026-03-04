

# Inventory Reconciliation: Surpluss vs GIF Data Mismatch

## Problem Summary

Three reported materials have discrepancies between the Surpluss platform's "Remaining" quantity and what GIF's database shows:

| Material | Surpluss Total | Surpluss Remaining | GIF total_stock | GIF Allocated | GIF Distributed |
|----------|---------------|-------------------|-----------------|---------------|-----------------|
| 907 King Duvet | 208 | 121 | 429 | 0 | 0 |
| 935 Men's Clothes | 4,088 | 1,168 | 1,168 | 0 | 0 |
| 918 Boys' Perfume | 2,000 | 770 | 370 | 730 | 730 |

**Root causes identified:**
1. GIF's `total_stock` is populated from `donation.quantity` in the Surpluss API, which returns the **remaining unallocated quantity on Surpluss**, not the total donated or the amount allocated to GIF.
2. Surpluss's "Remaining" includes deductions from allocations to **all organizations** (not just GIF), so GIF cannot reconcile by looking at its own data alone.
3. No tool exists in GIF to do a per-material cross-marketplace breakdown for quick reconciliation.

## Plan

### 1. Create a Material Reconciliation Diagnostic Edge Function
**New function: `audit-material-reconciliation`**
- Accepts a list of material IDs (or "all") and environment
- Calls the Surpluss donations API for each material to get the platform's `total` and `remaining`
- Queries the GIF database for `total_stock`, and sums all `marketplace_item_allocations` (allocated + distributed) per material
- Returns a side-by-side report:
  - Surpluss Total vs GIF total_stock
  - Surpluss Remaining vs (Surpluss Total - GIF allocated)
  - Per-marketplace allocation breakdown
  - Flags discrepancies

### 2. Add Per-Material Cross-Marketplace Breakdown View
**Update: `src/components/admin/AllocationManagement.tsx`**
- Add a new "Material Lookup" search box (by Material ID or name)
- When a material is selected, show a breakdown table across ALL marketplaces:
  - Marketplace name | Allocated | Distributed | Remaining
  - Global totals row at bottom
  - Over-allocation warning if sum > total_stock
- This addresses the client's request: "Would be helpful to have a view showing per-Material ID allocation breakdown across marketplaces"

### 3. Fix the `sync-surpluss-allocations` total_stock mapping
**Update: `supabase/functions/sync-surpluss-allocations/index.ts`**
- Currently writes `donation.quantity` as `total_stock` (line ~183: `quantity: donation.quantity ?? 0`)
- Change to use the correct field that represents the amount allocated to GIF specifically
- If that field isn't available from the donations endpoint, use the sum of `donation-allocations` amounts for GIF's events as the `total_stock`

## Files Changed
1. **New**: `supabase/functions/audit-material-reconciliation/index.ts` — diagnostic edge function
2. **Edit**: `src/components/admin/AllocationManagement.tsx` — add material lookup cross-marketplace view
3. **Edit**: `supabase/functions/sync-surpluss-allocations/index.ts` — fix total_stock source field

