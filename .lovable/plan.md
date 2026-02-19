

# Fix Distribution Count and Items Left Accuracy

## Problem Summary
The "Items Given" shows 8,714 and "Items Left" shows 10,154. On-ground staff report only a few boxes remain, so 10,154 is clearly wrong. The root causes are:

1. **Many beneficiaries were capped at the old 15-item limit** before it was changed to 25. 243 cards collected only 1-15 items (2,700 total), while 282 cards that came after the change collected 16-25 items (5,603 total). This means the system blocked roughly 243 people from collecting their full 25 items.

2. **The "Items Left" calculation** = Total Allocated (18,868) minus Items Given (8,714) = 10,154. This is mathematically correct based on the data, but the **allocation total (18,868) does not reflect reality** if items were physically distributed beyond what the system tracked, or if allocations were set higher than actual physical stock.

3. **38 beneficiary cards had 0 distributions** -- activated at entrance but never scanned at marketplace stations.

4. **16 stale transactions from January 5** are mixed into today's count (minor: 8,714 includes 16 old + 8,698 today).

## Data Breakdown

```text
Cards with 1-15 items:   243 cards -> 2,700 items  (many hit old 15 limit)
Cards with 16-25 items:  282 cards -> 5,603 items  (new 25 limit)
Cards with 26+ items:     14 cards ->   411 items  (over-limit edge cases)
Cards with 0 items:       38 cards ->     0 items  (no marketplace scan)
                         ----          -----
Total:                   577 cards    8,714 items
```

If all 577 had gotten 25: expected = 14,425 items. Actual = 8,714. Gap = 5,711.

## Proposed Fixes

### Fix 1: Correct the "Items Left" Calculation
The "Items Left" should reflect physical reality. Two options:

**Option A (Recommended)**: Use the marketplace's manual count data if available, or calculate "Items Left" as `Total Allocated - actual distributions from transactions` (which is what it does now). The real issue is the **allocation number (18,868) is too high** relative to actual stock. The admin should adjust allocations to match physical inventory.

**Option B**: Show "Items Left" based on the manual item counts entered by volunteers in the Manual Count zone, which reflects actual physical remaining stock. If manual counts exist, prefer those over the calculated value.

### Fix 2: Clean Up Stale Transactions
Remove the 16 January 5th transactions from the count by filtering the `get_marketplace_distribution_count` RPC to only count today's transactions (or transactions after the marketplace became active).

### Fix 3: Prevent Future Old-Limit Capping
The `distribute_marketplace_item` RPC already reads `beneficiary_credit_limit` dynamically from the marketplace. The client-side `distributeItem` mutation also reads it dynamically. No code change needed -- the limit was already updated to 25 and future cards will respect it.

### Fix 4: Update "Items Left" to Use Manual Counts When Available
In `useMarketplaceAllocations.ts`, when calculating `totalRemaining`, check if `marketplace_manual_counts` has data for this marketplace. If manual remaining counts exist, use `SUM(actual_remaining)` from that table instead of `totalAllocated - totalDistributed`.

## Technical Changes

### 1. Update `get_marketplace_distribution_count` RPC (SQL migration)
Add a date filter to exclude stale transactions from previous events on recycled cards.

### 2. Update `useMarketplaceAllocations.ts` report hook
When computing `totalRemaining`, query `marketplace_manual_counts` for the marketplace. If data exists, use the sum of `actual_remaining` as the "Items Left" value. This gives on-ground accuracy.

### 3. Update MarketplaceReports display
Add a visual indicator when "Items Left" is based on manual counts vs calculated from allocations, so admins know which source is being used.

