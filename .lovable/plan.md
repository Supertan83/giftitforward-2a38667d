

## Fix Credits Used Calculation

### Problem
"Credits Used" uses `sum(credit_limit - remaining_balance)` per card. When cards are checked out, `credit_balance` resets to 0, so the entire credit limit counts as "used" — massively inflating the number (7575 vs 4304 actual items).

### Fix
**File: `src/components/zones/StatsDashboardZone.tsx`**

Replace the `totalCreditsUsed` calculation with `totalItemsDistributed` (which already comes from `marketplace_item_allocations.distributed_quantity` — the accurate count).

Remove the `marketplaceLimitMap` and `totalCreditsUsed` loop (~10 lines). Change the "Credits Used" display to show `beneficiaryStats.totalItemsDistributed` with label "Total Credits Used", since each item distributed = 1 credit used.

This is a ~5-line change in the `beneficiaryStats` memo and 1 line in the JSX.

