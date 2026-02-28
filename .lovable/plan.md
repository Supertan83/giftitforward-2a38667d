

# Auto-Transition Marketplace Status: Upcoming to Active

## Problem
The marketplace "She Thrives Women Workers Marketplace February 28" has `event_date: 2026-02-28` and `start_time: 07:30:00`, but the status remains "upcoming" because:
- The database stores `status = 'upcoming'` and no code ever updates it to `'active'` when the event starts
- The existing client-side guard in `useSupabaseData.ts` (line 1244) only handles the transition to "completed" (when `now > endTime`), never the transition to "active" (when `now >= startTime`)

## Solution
Add a second client-side status computation: if the marketplace is "upcoming", the event date is today (or past), and the current time is at or past the start time, auto-promote the status to "active".

## File Changed
**`src/hooks/useSupabaseData.ts`** (lines ~1241-1258)

Update the status computation logic to add an "upcoming -> active" transition:

```text
For each marketplace:
1. If status is "upcoming" AND not locked by admin AND event_date exists:
   - Build a startDateTime from event_date + start_time (default 00:00 if no start_time)
   - Build an endDateTime from event_date + end_time (default 23:59 if no end_time)
   - If now >= endDateTime -> set status to "completed"
   - Else if now >= startDateTime -> set status to "active"
2. If status is "active" AND not locked by admin:
   - Same end-time check as before -> "completed"
```

This is purely a display/client-side computation -- the DB value remains unchanged, preserving the admin override (`status_locked_by_admin`) behavior.

No database migration needed. Single file edit.
