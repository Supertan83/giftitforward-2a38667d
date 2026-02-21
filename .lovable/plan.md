

# Fix: Marketplace Events Stuck on "Active" After End Time

## Problem
"Young Dreamers Boys Community School Marketplace" (Feb 19, 7:00 AM - 1:30 PM) and "Stronger Together Emirati Family Community Marketplace February 21" (Feb 21, 7:30 PM - 11:30 PM) are still showing as "active" even though their event times have passed. The system has no automatic mechanism to transition marketplace status from "active" to "completed".

## Solution (Two Parts)

### Part 1 -- Immediate Data Fix
Update the two marketplace records to "completed" status directly in the database.

### Part 2 -- Automatic Status Transition
Add logic to automatically mark marketplaces as "completed" when their event date + end time has passed. This will be implemented as a database function called via a scheduled edge function (or integrated into the existing `auto-unblock-cards` function which already runs daily and resets cards from previous days).

**Approach**: Add a simple SQL update inside the existing `auto-unblock-cards` edge function that sets `status = 'completed'` for any marketplace where:
- `status = 'active'`
- `event_date + end_time < now()` (or just `event_date < today` if no end_time is set)

This keeps things simple with no new functions to deploy or maintain.

## Technical Details

### 1. Data Fix (SQL update)
```sql
UPDATE marketplace_events
SET status = 'completed', updated_at = now()
WHERE id IN (
  '49fb6332-2eb5-417d-a076-d3a66af20ba9',  -- Young Dreamers
  '956e826c-e54a-49e7-9cc5-ed6d4cb10e34'   -- Stronger Together Feb 21
);
```

### 2. Update `supabase/functions/auto-unblock-cards/index.ts`
Add a step before the card unblocking that automatically transitions marketplace status:

```typescript
// Auto-complete marketplaces whose event date+end_time has passed
const { data: completedMarketplaces } = await supabase
  .from('marketplace_events')
  .select('id, name, event_date, end_time')
  .eq('status', 'active');

// For each active marketplace, check if event_date + end_time < now
// Update to 'completed' if so
```

### 3. Also add client-side guard in `src/hooks/useSupabaseData.ts`
In the `useMarketplaces` hook, add a computed check so that even if the DB hasn't been updated yet, the UI shows the correct status based on current time. This provides immediate visual correctness while the scheduled job handles the DB update.

