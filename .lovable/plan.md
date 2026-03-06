

# Fix: Volunteer Registration Count Inflated by Substring Matching

## Problem
The marketplace report for "Feb 28" shows 114 registered volunteers instead of the actual ~44. Two bugs in `useMarketplaceAllocations.ts`:

1. **Substring matching** (line 494): `.includes(marketplaceNameSlug)` matches "february-28" inside "february-28---second-half", "february-28--second-half", etc. — counting volunteers from other sessions. DB confirms: substring match = 93, exact match per event = 44.

2. **Missing status filter** (line 484-487): The query fetches ALL volunteers with `events_list`, not just approved ones — adds 3 extra non-approved volunteers.

Combined, these inflate the count from the correct ~44 to 114.

## Fix

### File: `src/hooks/useMarketplaceAllocations.ts` (lines 483-495)

1. Add `.eq('status', 'approved')` to the `pending_volunteers` query
2. Replace `.includes()` substring matching with split-by-comma exact slug matching (same pattern already used correctly in `useVolunteerDetails.ts` lines 57-58):

```typescript
const formRegisteredVolunteers = (pendingVolunteers || []).filter(pv => {
  if (!pv.events_list) return false;
  return pv.events_list.split(',').some(
    slug => slug.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === marketplaceNameSlug
  );
});
```

This brings the count down to the correct ~44 volunteers for the first half marketplace specifically.

