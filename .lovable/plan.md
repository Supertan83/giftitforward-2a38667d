

# Fix Volunteer Checkout Timing Bug

## Problem
When a volunteer is checked out and then re-checked-in, the system updates `checked_in_at` but does NOT clear `checked_out_at`. This leaves stale checkout timestamps that appear earlier than the check-in time, producing incorrect timing data.

Example from today: Taleen El Beaini shows check-in at 05:01 but check-out at 04:43 (18 minutes before check-in). She was checked out at 04:43, then re-checked-in at 05:01, but the old checkout time was never cleared.

Additionally, 3 volunteers (Jawaher x2 and bassam) show check-in to check-out durations of only 10-25 seconds, indicating accidental checkouts.

## Changes

### 1. Fix `checkInVolunteer` mutation in `src/hooks/useSupabaseData.ts` (line 1386-1394)

Clear `checked_out_at` when re-checking in a volunteer so stale checkout timestamps don't persist.

```typescript
// Current code (missing checked_out_at reset):
.update({
  status: 'checked_in',
  checked_in_at: now,
  marketplace_id: marketplaceId || null,
  assigned_zone: assignedZone || null
})

// Fixed code:
.update({
  status: 'checked_in',
  checked_in_at: now,
  checked_out_at: null,          // Clear stale checkout time
  marketplace_id: marketplaceId || null,
  assigned_zone: assignedZone || null
})
```

### 2. Fix `checkOutVolunteer` mutation -- add minimum duration guard (line 1432-1434)

Add a guard to prevent accidental checkouts that happen within seconds of check-in. If less than 1 minute has passed since check-in, reject the checkout with an error message.

```typescript
const hoursWorked = (now.getTime() - checkedInAt.getTime()) / (1000 * 60 * 60);

// Prevent accidental immediate checkouts (less than 1 minute)
if (hoursWorked < (1 / 60)) {
  throw new SafeError('Cannot check out within 1 minute of check-in. Please wait.');
}
```

### 3. Data Fix (SQL) -- Correct today's stale data

Clear the stale `checked_out_at` on Taleen's card (currently checked_in but showing old checkout time):

```sql
UPDATE volunteer_qr_cards
SET checked_out_at = NULL
WHERE id = 'aee4e72f-40db-4c13-8d16-98de60eaf0cd'
  AND status = 'checked_in';
```

## Summary of Changes

- **1 SQL data fix** to correct today's stale checkout timestamp
- **1 line added** to `checkInVolunteer`: clear `checked_out_at` on re-check-in
- **3 lines added** to `checkOutVolunteer`: reject checkouts less than 1 minute after check-in

