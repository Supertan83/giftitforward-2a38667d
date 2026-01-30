
# Fix: User Management Edit Dialog Not Showing Names

## Problem Identified

When clicking "Edit" on a user in User Management, the First Name and Last Name fields appear empty.

### Root Cause
The `get-users` edge function fetches names from **auth user metadata** (`authUser.user_metadata.first_name`), but most volunteers were created via webhooks where names are stored in the **`pending_volunteers` table** instead.

Currently, the edge function queries `pending_volunteers` but only selects:
```sql
SELECT id, created_user_id FROM pending_volunteers
```

It doesn't include `first_name` or `last_name`, so those values are never returned.

---

## Solution

Update the `get-users` edge function to:
1. Fetch `first_name` and `last_name` from `pending_volunteers`
2. Create a map of auth user ID to volunteer names
3. Use `pending_volunteers` names as the primary source, falling back to auth metadata if not available

---

## Technical Changes

**File:** `supabase/functions/get-users/index.ts`

### Change 1: Update pending_volunteers query
```typescript
// Current (missing names)
.select('id, created_user_id')

// Fixed
.select('id, created_user_id, first_name, last_name')
```

### Change 2: Create a name lookup map
```typescript
// Map auth_user_id to volunteer name info
const authUserToName = new Map<string, { first_name: string; last_name: string }>();
pendingVolunteers?.forEach(pv => {
  if (pv.created_user_id) {
    authUserToName.set(pv.created_user_id, {
      first_name: pv.first_name || '',
      last_name: pv.last_name || ''
    });
  }
});
```

### Change 3: Use volunteer names with auth metadata fallback
```typescript
// Current
first_name: (authUser?.user_metadata?.first_name as string) || null,
last_name: (authUser?.user_metadata?.last_name as string) || null,

// Fixed - prioritize pending_volunteers, fallback to auth metadata
const volunteerName = authUserToName.get(role.user_id);
first_name: volunteerName?.first_name || (authUser?.user_metadata?.first_name as string) || null,
last_name: volunteerName?.last_name || (authUser?.user_metadata?.last_name as string) || null,
```

---

## Expected Result

After this fix:
- Clicking "Edit" on any user will show their First Name and Last Name pre-populated
- Names will come from `pending_volunteers` for webhook-created volunteers
- Names will fall back to auth user metadata for manually created users
