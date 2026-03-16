

# Fix: Manually Added Volunteers Not Showing

## Root Cause

Two issues identified by examining the code and database:

### Issue 1: Missing `events_list` on manually created volunteers
When volunteers are created via the admin's "Create Volunteer" action (WebhookActionsPanel), the `webhook-receiver` edge function inserts into `pending_volunteers` **without setting `events_list`** (line 2887-2901). This means:
- If the admin has an event filter active in "Volunteers Added", these volunteers are invisible because they have no events to match against
- They appear only when filter is set to "All" — easy to miss

The same applies to volunteers created via User Management "Add User" — the `create-user` edge function sets `events_list` from `eventName`, but the UI **never sends `eventName`** (only `marketplaceId` is sent). So `events_list` is always `null` for these users too, even when a marketplace is selected.

### Issue 2: `get-users` has a 500-row limit (secondary)
The `get-users` edge function fetches only 500 `user_roles` entries (line 60). The database currently has **699 user_roles** — meaning 199 users are missing from User Management entirely. This is a separate but related visibility issue.

## Solution

### Fix 1: Set `events_list` when marketplace is selected during creation
**File: `supabase/functions/create-user/index.ts`**
- When a `marketplaceId` is provided, the function already looks up the marketplace name and builds `eventsJson`. But it sets `events_list` from the separate `eventName` param which is never sent.
- Fix: Also derive `events_list` from the marketplace lookup — set it to the marketplace name slug (same format as webhook registrations).

**File: `supabase/functions/webhook-receiver/index.ts`**
- In the `create_volunteer` action, accept an optional `marketplace_id` or `event_name` field
- If provided, set `events_list` on the `pending_volunteers` insert

### Fix 2: Remove or increase the 500-row limit in `get-users`
**File: `supabase/functions/get-users/index.ts`**
- Replace `.limit(500)` with paginated fetching (same pattern used for auth users) to ensure all user_roles are retrieved.

### Fix 3: Pass marketplace info from UI to edge function
**File: `src/hooks/useSupabaseData.ts`** (useCreateUser)
- Already passes `marketplaceId` — no change needed

**File: `src/components/admin/WebhookActionsPanel.tsx`**
- Add an optional marketplace selector to the manual volunteer creation form so that created volunteers get associated with an event

## Files to modify
1. `supabase/functions/create-user/index.ts` — derive `events_list` from marketplace lookup
2. `supabase/functions/get-users/index.ts` — remove 500 limit, paginate user_roles fetch
3. `supabase/functions/webhook-receiver/index.ts` — set `events_list` when marketplace context is available
4. `src/components/admin/WebhookActionsPanel.tsx` — add optional marketplace selector for manual creation

