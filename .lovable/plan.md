

# Fix Items Given and Items Left to Use Manual Counts

## Problem

The "Items Given" and "Items Left" stats in Marketplace Reports only use system-tracked allocation data (`distributed_quantity` from allocations and the `get_marketplace_distribution_count` RPC). After an event, admins manually enter actual distribution and remaining counts via the Manual Item Count feature, but those manual values are ignored in the report summary cards.

## Solution

Update the data-fetching logic in `src/hooks/useMarketplaceAllocations.ts` to incorporate manual counts from the `marketplace_manual_counts` table. When manual counts exist for a marketplace, use those as the source of truth for "Items Given" (sum of `actual_distributed`) and "Items Left" (sum of `actual_remaining`). Fall back to the current system-calculated values when no manual counts exist.

## Changes

### File: `src/hooks/useMarketplaceAllocations.ts`

**1. `useMarketplaceReport` (line ~362-494)**

- After fetching allocations, also fetch manual counts for the marketplace from `marketplace_manual_counts`
- For each item in `itemsByType`, check if a manual count exists for that `item_type_id`:
  - If yes: use `actual_distributed` and `actual_remaining` from the manual count
  - If no: keep the current allocation-based values
- Recalculate `totalDistributed` and `totalRemaining` as sums of the per-item values (which now incorporate manual overrides)

**2. `useAllMarketplaceReports` (line ~514-571)**

- For each marketplace, also fetch manual counts
- If manual counts exist, use `sum(actual_distributed)` for totalDistributed and `sum(actual_remaining)` for totalRemaining
- If no manual counts, fall back to current allocation-based calculation

### Per-Item Logic

```text
For each allocated item:
  manual = manual_counts.find(item_type_id matches)
  if manual exists:
    distributed = manual.actual_distributed
    remaining = manual.actual_remaining
  else:
    distributed = allocation.distributed_quantity
    remaining = allocation.allocated_quantity - allocation.distributed_quantity
```

### Summary Totals

```text
totalDistributed = sum of all per-item distributed values (manual-aware)
totalRemaining = sum of all per-item remaining values (manual-aware)
```

This ensures the top-level stat cards, the item distribution table, and the category aggregates all reflect manual corrections when they exist.

