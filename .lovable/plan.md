
# Fix: Marketplace Report Header Shows Stale "Upcoming" Status

## Problem
The dropdown list correctly shows "active" because it uses data from `useMarketplaces()` (which has the auto-transition logic in `useSupabaseData.ts`). However, the detail header uses `report.marketplace.status` from `useMarketplaceReport()` in `useMarketplaceAllocations.ts`, which reads the raw database value without applying the same time-based transition.

## Solution
Apply the same auto-transition logic in `useMarketplaceAllocations.ts` at line ~632, where the report's marketplace status is set.

## File Changed
**`src/hooks/useMarketplaceAllocations.ts`** (around line 630-632)

Before returning `status: marketplace.status`, compute the correct status using the same logic:
- Parse `event_date`, `start_time`, and `end_time`
- If `now > endDateTime` -> "completed"
- Else if status is "upcoming" and `now >= startDateTime` -> "active"
- Otherwise keep the DB value
- Respect `status_locked_by_admin` flag

This is a small, targeted change (~15 lines) in one file. No database changes needed.
