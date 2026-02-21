

# Fix: Today's Marketplace Event Not Appearing in Dropdown

## Problem
The "Stronger Together Emirati Family Community Marketplace February 21" event exists in the database with status `active` but does not appear in the Volunteer Zone marketplace dropdown. Events starting from February 22 show up, but today's event is missing.

## Root Cause: Timezone Bug in Client-Side Status Guard

The `useMarketplaces` hook has a client-side guard that marks events as "completed" if their date+time has passed. The bug is in how the event date string is parsed:

```
new Date("2026-02-21")  -->  Feb 21 00:00 UTC  -->  Feb 20 20:00 in Dubai (UTC+4)
setHours(23, 30)        -->  Feb 20 23:30 local (Dubai)
```

Because `new Date("YYYY-MM-DD")` parses as **UTC midnight**, the resulting date is actually the **previous evening** in Dubai time. So at 6:38 AM on Feb 21, the system thinks the event ended on Feb 20 at 23:30 -- and marks it `completed`. The Volunteer Zone then filters it out since it only shows `upcoming` or `active` events.

## Fix

### File: `src/hooks/useSupabaseData.ts` (~line 1191)

Parse the event date as a **local date** instead of UTC by splitting the date string manually:

**Before:**
```typescript
const eventDate = new Date(item.event_date);
```

**After:**
```typescript
const [year, month, day] = item.event_date.split('-').map(Number);
const eventDate = new Date(year, month - 1, day);
```

This ensures the date is constructed in the **local timezone** (e.g., Feb 21 00:00 Dubai time), so `setHours(23, 30)` correctly sets it to Feb 21 23:30 Dubai time.

This is a one-line change in a single file. No backend or database changes needed.

