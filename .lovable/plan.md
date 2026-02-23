

# Allow Admins to Manually Override Marketplace Status

## Problem

When a marketplace event's scheduled time passes, both the client-side guard (in `useMarketplaces`) and the server-side cron (`auto-unblock-cards`) automatically set the status to "completed." Even if an admin edits the event back to "active" in the admin dashboard, the client immediately overrides it back to "completed" because the event time has passed. This prevents the team from doing late volunteer check-ins/check-outs for demographic tracking.

## Solution

Add a `status_locked_by_admin` boolean column to `marketplace_events`. When an admin manually changes the status via the edit modal, this flag is set to `true`. Both the client-side guard and the server-side cron will **skip** events where this flag is `true`, respecting the admin's manual override.

If the admin later sets the status back to "completed" manually, the lock flag is cleared so automatic behavior resumes normally.

## What Changes

### 1. Database Migration
- Add `status_locked_by_admin` boolean column to `marketplace_events`, default `false`.

### 2. Admin Edit Modal (`MarketplaceManagement.tsx`)
- When saving an edit, if the admin changed the status field, set `status_locked_by_admin = true`.
- If the admin sets it to "completed", clear the flag (`status_locked_by_admin = false`) so the auto-complete logic can resume for future use.

### 3. Client-Side Status Guard (`useSupabaseData.ts` -- `useMarketplaces`)
- In the `computedStatus` logic (lines 1228-1241), skip the auto-complete override if `item.status_locked_by_admin === true`.

### 4. Server-Side Cron (`auto-unblock-cards/index.ts`)
- In the marketplace auto-completion query, exclude events where `status_locked_by_admin = true`.

### 5. Update Mutation (`useUpdateMarketplace`)
- Add `status_locked_by_admin` to the update payload type.

## What Does NOT Change
- Card unblocking logic (still resets cards from previous days)
- Check-in/check-out flows
- Volunteer attendance tracking
- Report rendering
- The automatic status transition still works for all events that are NOT manually overridden

## Technical Details

### Database
```sql
ALTER TABLE marketplace_events 
ADD COLUMN status_locked_by_admin boolean NOT NULL DEFAULT false;
```

### Client Guard Update (useMarketplaces)
```text
// Before:
if ((computedStatus === 'active' || computedStatus === 'upcoming') && item.event_date) {
  // ... auto-complete logic
}

// After:
if (!item.status_locked_by_admin && (computedStatus === 'active' || ...) && item.event_date) {
  // ... auto-complete logic (skipped when admin locked)
}
```

### Admin Edit Save Logic
```text
// When admin changes status:
if (status changed from DB value) {
  if (newStatus === 'completed') {
    status_locked_by_admin = false  // release lock, auto-logic can resume
  } else {
    status_locked_by_admin = true   // lock it so auto-complete won't override
  }
}
```

### Auto-Unblock Cron Update
```text
// Add filter to skip locked events:
.select("id, name, event_date, end_time, status_locked_by_admin")
.in("status", ["active", "upcoming"])
// Then in the loop:
if (mp.status_locked_by_admin) continue;
```

