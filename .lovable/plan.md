

# Fix Distribution Counter Mismatch

## Problem
The "Young Dreamers Boys Community School Marketplace" has **3,253 actual distribution transactions** recorded, but the allocation tracking table (`marketplace_item_allocations`) only shows **22 total distributed**. This means the "Total Scanned" counter on the volunteer screen is showing ~22 instead of the real number.

## Root Cause
The database RPC function `distribute_marketplace_item` picks the **first allocation** (by `created_at`) and increments its `distributed_quantity`. This has been working, but it appears the bulk of early scans happened through a different code path (the older `distributeItem` function in `useSupabaseData.ts`) that updates the card and creates a transaction but does NOT increment the allocation's `distributed_quantity`. Only recent scans using the newer `distributeItemSimple` (which calls the RPC) correctly updated the counter.

## Fix

### Step 1: Data Correction (Database Update)
Update the first allocation record for this marketplace to reflect the true total of 3,253 distributions (from the transactions table). Since the system doesn't track per-item-type distributions (it's a generic scan), all counts go to the first allocation:

```sql
-- Set distributed_quantity on the first allocation to match actual transaction count
UPDATE marketplace_item_allocations
SET distributed_quantity = 3253
WHERE id = (
  SELECT id FROM marketplace_item_allocations
  WHERE marketplace_id = '49fb6332-2eb5-417d-a076-d3a66af20ba9'
  ORDER BY created_at ASC
  LIMIT 1
);

-- Reset the small count on any other allocation that got a stray increment
UPDATE marketplace_item_allocations
SET distributed_quantity = 0
WHERE marketplace_id = '49fb6332-2eb5-417d-a076-d3a66af20ba9'
  AND id != (
    SELECT id FROM marketplace_item_allocations
    WHERE marketplace_id = '49fb6332-2eb5-417d-a076-d3a66af20ba9'
    ORDER BY created_at ASC
    LIMIT 1
  )
  AND distributed_quantity > 0;
```

### Step 2: Remove Old Code Path
The older `distributeItem` function in `useSupabaseData.ts` (the non-RPC path) is no longer used by the Marketplace Zone but still exists. To prevent future mismatches, verify that **only** `distributeItemSimple` (which calls the atomic RPC) is used for marketplace scanning. No code change needed since the MarketplaceZone already uses `distributeItemSimple`.

### Step 3: Publish
Push the updated app to the live site so volunteers see the correct "Total Scanned" number.

## Technical Details
- **Marketplace ID**: `49fb6332-2eb5-417d-a076-d3a66af20ba9`
- **Actual distributions** (from `transactions` table): 3,253
- **Current allocation tracking**: 22 (wrong)
- **Cards with items**: 583 credit_balance across active cards (net current, lower because checkouts reset balances)

