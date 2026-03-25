

# Fix: Manually Created Volunteer Not Showing in Manage Users

## Problem
The `create-user` edge function has a **variable scope bug** on line 207. The variable `mpData` is declared inside an `if (marketplaceId)` block (line 189) but referenced outside it (line 207). When a volunteer is created **without selecting a marketplace**, this causes a runtime crash.

The crash happens AFTER the auth user and role are already created (lines 136-170), but BEFORE the `pending_volunteers` record is created (line 212). This means:
- The function returns a 500 error
- The frontend sees a failure, doesn't refresh the user list → user appears "not created"
- The auth user and role DO exist in the database (partially created)
- No `pending_volunteers` record → no name, no QR card
- On page refresh, the user appears but with no name or volunteer details

## Fix

### `supabase/functions/create-user/index.ts`
Move the marketplace data lookup (`mpData`) outside the `if (marketplaceId)` block scope, or restructure so line 207 can safely access it:

```typescript
// Line 184-209: restructure to keep mpData in scope
if (role === 'volunteer') {
  let eventsJson = null;
  let mpData = null;  // ← declare in outer scope
  
  if (marketplaceId) {
    const { data } = await supabaseAdmin
      .from('marketplace_events')
      .select('name, event_date, start_time, end_time, location')
      .eq('id', marketplaceId)
      .maybeSingle();
    mpData = data;
    
    if (mpData) {
      eventsJson = [{ ... }];
    }
  }

  let derivedEventsList = eventName?.trim() || null;
  if (!derivedEventsList && mpData) {  // ← now safe
    derivedEventsList = mpData.name.toLowerCase().replace(/\s+/g, '-');
  }
  // ... rest unchanged
}
```

This is a one-line scoping fix in the edge function. No other files need changes.

### Files to modify
- `supabase/functions/create-user/index.ts` (fix `mpData` scope)

