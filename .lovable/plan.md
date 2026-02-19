

# Permanent Fix: Distribution Counter Always Accurate

## Problem
The "Total Scanned" counter on the volunteer screen and marketplace reports keeps falling out of sync. We've manually corrected it 3 times now. The root cause is that the `distribute_marketplace_item` RPC only increments one allocation record, and various edge cases (resets, old code paths, race conditions) cause the counter to drift.

## Solution
Instead of relying on the `distributed_quantity` column in `marketplace_item_allocations`, read the actual count directly from the `transactions` table -- which is the single source of truth since every scan creates a transaction record.

## Changes

### 1. New database function: `get_marketplace_distribution_count`
Create an RPC function that counts actual Distribution transactions for a given marketplace. This is a simple COUNT query on the transactions table joined with qr_cards.

### 2. Update `useMarketplaceAllocations` hook
After fetching allocations, also call the new RPC to get the true distribution count. Override the `distributedQuantity` total with the real transaction count so the volunteer screen shows accurate numbers.

### 3. Update `useMarketplaceReport` hook
In the report generation, replace the sum of `distributed_quantity` from allocations with the actual transaction count from the new RPC. This fixes the marketplace reports as well.

### 4. Immediate data correction
Update the primary allocation record to match the current actual count (4,196) so that the allocation table is also in sync right now.

## Technical Details

**New SQL function:**
```sql
CREATE OR REPLACE FUNCTION get_marketplace_distribution_count(p_marketplace_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COUNT(*)
  FROM transactions t
  JOIN qr_cards q ON t.card_id = q.id
  WHERE q.marketplace_id = p_marketplace_id
    AND t.type = 'Distribution';
$$;
```

**MarketplaceZone changes:**
- The `totalScanned` variable will use the transaction-based count instead of summing `distributed_quantity` from allocations
- This ensures the big center number and the "Total Scanned" stat card are always correct

**Report changes:**
- `totalDistributed` in the report will come from the transaction count
- Individual item-level distribution breakdowns will remain from allocation records (for per-item reporting)

## What This Fixes
- Volunteer screen "Total Scanned" will always be accurate (currently showing ~90, should be 4,196)
- Marketplace reports will show correct totals
- No more manual database corrections needed
- Future scans will be reflected immediately since transactions are always written
