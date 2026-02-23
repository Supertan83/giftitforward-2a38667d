

# Fix Marketplace Status: Mark Past "Upcoming" Events as Completed

## The Problem

Marketplaces that were never manually set to "active" before their event date passed remain stuck as "upcoming" forever. The current status guard only handles `active` -> `completed` transitions, not `upcoming` -> `completed`.

For example, "Stronger Together... February 21" still shows as "upcoming" even though today is February 23.

## The Fix

### 1. Extend client-side status guard in `useMarketplaces` (useSupabaseData.ts, ~line 1188)

Add a second condition: if a marketplace is `upcoming` and its event date (+ end time) has passed, compute its status as `completed`.

```
// Current: only handles active -> completed
// New: also handles upcoming -> completed for past events
if ((computedStatus === 'active' || computedStatus === 'upcoming') && item.event_date) {
  // ... same date parsing logic ...
  if (now > eventDate) {
    computedStatus = 'completed';
  }
}
```

This is a one-line change to the condition on line 1190.

### 2. Extend the auto-unblock edge function (auto-unblock-cards/index.ts, ~line 26)

Update the database query to also find `upcoming` marketplaces that have ended, so the persisted status in the database also gets corrected:

Change `.eq("status", "active")` to `.in("status", ["active", "upcoming"])`.

This ensures the next time the auto-unblock job runs, it permanently marks these stale "upcoming" events as "completed" in the database too.

## Files to Change

1. **`src/hooks/useSupabaseData.ts`** -- Extend the client-side guard condition (line 1190) to include `upcoming`
2. **`supabase/functions/auto-unblock-cards/index.ts`** -- Query both `active` and `upcoming` statuses (line 26)

## No database changes needed
