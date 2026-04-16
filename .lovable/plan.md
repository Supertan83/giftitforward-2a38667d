

## Fix: Auto-Reset Not Working for Admin-Locked Extended Marketplaces

### Root Cause
When we extended the morning marketplace earlier today, we set `status_locked_by_admin = true` and `end_time = NULL`. The `auto-unblock-cards` edge function explicitly skips admin-locked events (`if (mp.status_locked_by_admin) continue;`), so the April 15 morning marketplace will stay `active` forever.

### Actions

**1. Immediately complete the April 15 morning marketplace** (data operation)
- Set status to `completed`, restore a reasonable end_time, unlock admin lock
- This is safe because all cards are already inactive and all data is archived

**2. Update `auto-unblock-cards` edge function logic**
- Change the admin-lock skip logic: instead of skipping entirely, only skip events whose `event_date` is today
- If the event_date has **passed** (is before today), auto-complete it regardless of admin lock
- This way, admin-locking protects a marketplace during the day of the event, but doesn't prevent overnight cleanup

Updated logic:
```typescript
for (const mp of activeMarketplaces) {
  if (!mp.event_date) continue;
  const eventDate = new Date(mp.event_date);
  const eventEnd = new Date(mp.event_date);
  // ... set hours from end_time ...
  
  // If admin-locked AND event is today, skip (respect the lock during the event day)
  if (mp.status_locked_by_admin && eventDate.toDateString() === now.toDateString()) continue;
  
  // If event has ended (or event_date is in the past), auto-complete
  if (now > eventEnd) {
    idsToComplete.push(mp.id);
  }
}
```

**3. Deploy updated function**

### Files changed
- `supabase/functions/auto-unblock-cards/index.ts` — update admin-lock logic

### Data operation
- UPDATE `marketplace_events` SET status='completed', status_locked_by_admin=false, end_time='23:59' WHERE id='3f44eb86-f1c5-48a4-8bf3-5b70b41c5bfd'

