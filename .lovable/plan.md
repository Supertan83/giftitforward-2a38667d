

## Unlock Dry Run Friday Marketplace

### Problem
The "Dry Run Friday Marketplace - 27/02" (1 PM - 3 PM UAE) is stuck in "upcoming" status because `status_locked_by_admin` is set to `true`. This prevents the auto-transition system from changing it to "active" when 1 PM arrives.

### Fix
A single database update to set `status_locked_by_admin = false` on the Dry Run marketplace record (`d21fba59-2bf2-4a47-bd10-f88278d4c95e`).

```sql
UPDATE marketplace_events
SET status_locked_by_admin = false, updated_at = now()
WHERE id = 'd21fba59-2bf2-4a47-bd10-f88278d4c95e';
```

### What happens after
- The auto-unblock-cards edge function (and client-side status guard) will transition the Dry Run to "active" once 1 PM UAE arrives, and to "completed" after 3 PM UAE.
- The Feb 28 marketplaces are already unlocked and will auto-transition normally at 7:30 AM and 7:30 PM UAE respectively.

### Verification
After the update, confirm all three upcoming events show `status_locked_by_admin = false`.

