

# Fix: User Management Not Showing All Volunteers

## Problem Identified

The "User Management" section is only showing **50 users** instead of the expected **128+ users** because the `get-users` edge function uses `supabase.auth.admin.listUsers()` without pagination parameters.

According to Supabase documentation, `listUsers()` **defaults to returning 50 users per page**. Since you have 128 auth users, roughly 78 users are being silently omitted.

### Current Data Counts
| Source | Count |
|--------|-------|
| Approved pending_volunteers | 126 |
| user_roles (volunteer) | 124 |
| auth.users (total) | 128 |
| **Currently displayed** | ~50 |

---

## Solution

Update the `get-users` edge function to fetch **all pages** of auth users, not just the first 50.

### Technical Changes

**File:** `supabase/functions/get-users/index.ts`

```typescript
// Current (broken - only gets first 50)
const { data: { users: authUsers }, error: usersError } = 
  await supabaseAdmin.auth.admin.listUsers()

// Fixed - fetch all pages
const allAuthUsers = [];
let page = 1;
const perPage = 1000; // Max per page
let hasMore = true;

while (hasMore) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page,
    perPage
  });
  
  if (error) throw error;
  
  allAuthUsers.push(...(data.users || []));
  hasMore = data.users.length === perPage;
  page++;
}
```

This approach:
1. Uses the `page` and `perPage` parameters to fetch users in batches
2. Loops until no more users are returned
3. Collects all users into a single array for processing

---

## Expected Result

After this fix:
- **User Management** will show all 128 users (matching auth.users count)
- The volunteer filter will show all 124 volunteers
- No users will be silently dropped from the list

