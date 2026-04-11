

## Fix: Published Registration Page Cannot Load Marketplaces

### Root Cause

The `/register` page is public (no login required), but the `marketplace_events` table only has RLS policies for **admin** and **staff** roles. Unauthenticated visitors on the published site get zero rows back.

### Fix

Add a restrictive public SELECT policy on `marketplace_events` that only exposes `active` events to anonymous/unauthenticated users.

```sql
CREATE POLICY "Public can view active marketplace events"
  ON public.marketplace_events
  FOR SELECT
  TO anon
  USING (status = 'active');
```

This is safe because:
- Only rows with `status = 'active'` are visible
- The query on the registration page already selects only `id, name` — no sensitive data
- The policy targets the `anon` role specifically, so it does not broaden access for authenticated users

### Changes

| Action | Type |
|---|---|
| Add RLS policy for anon SELECT on `marketplace_events` where `status = 'active'` | Database migration |

No code changes needed — the page query is already correct.

