
# Duplicate Volunteer Handling System

## Overview
When a volunteer tries to register with an email that already exists in the system, instead of silently ignoring the submission, we will:
1. Store the new submission data in a "Duplicate Volunteers" section (for admin review)
2. Send an informational email to the user explaining they already have a profile
3. Allow admins to manually review and update user information from the duplicate submissions

---

## Technical Implementation

### Part 1: Database Changes

**Add new status value for duplicates**

We need to add a new status value `duplicate` to track these submissions. The `pending_volunteers` table already has a `status` column (text type), so we can simply insert records with `status = 'duplicate'`.

No schema changes needed - we'll use the existing table structure with:
- `status = 'duplicate'`
- Store the `original_volunteer_id` reference in `source_data` JSON field

---

### Part 2: Edge Function Changes

**File: `supabase/functions/webhook-receiver/index.ts`**

Modify the duplicate detection logic (around line 3144) to:

1. **Before user creation** - Check if email already exists:
   ```text
   Check pending_volunteers for approved record with same email
   If found → Handle as duplicate
   ```

2. **On "already registered" error** - Handle gracefully:
   ```text
   Instead of creating a pending record:
   - Create record with status = 'duplicate'
   - Store reference to original volunteer
   - Send duplicate notification email
   - Return success (don't fail the webhook)
   ```

3. **Create a new helper function** `handleDuplicateSubmission()`:
   - Creates duplicate record with all new form data
   - Links to original volunteer via `source_data.original_volunteer_id`
   - Triggers duplicate notification email

---

### Part 3: Duplicate Notification Email

**Create new email template in webhook-receiver**

Following the existing Dubai Holding email structure with:
- Same branding (hero image, colors, footer)
- Same sender: `giftitforward@dubaiholding.com`
- Same BCC tracking

**Email Content:**
```text
Subject: Gift It Forward - Registration Update

Dear [First Name],

Thank you for your interest in volunteering with Gift It Forward.

Our records show that you already have a volunteer profile registered 
with this email address.

If you need to update your registration details or have any questions, 
please contact us at:
giftitforward@dubaiholding.com

We look forward to seeing you at the marketplace!

Warm regards,
Gift It Forward Team
```

---

### Part 4: Admin UI Changes

**File: `src/components/admin/PendingVolunteers.tsx`**

1. **Add new tab**: "Duplicate Submissions"
   ```
   [Partner Volunteers] [Bulk Uploaded] [Missing Email] [Duplicates]
   ```

2. **Add count query** for duplicates:
   ```typescript
   const duplicateCount = useQuery({
     queryKey: ['duplicate-volunteers-count'],
     queryFn: async () => {
       const { count } = await supabase
         .from('pending_volunteers')
         .select('*', { count: 'exact', head: true })
         .eq('status', 'duplicate');
       return count || 0;
     }
   });
   ```

3. **Update tab filtering**:
   - New tab value: `'duplicates'`
   - Query filter: `.eq('status', 'duplicate')`

4. **Add "View Original" button** in the table:
   - Shows link to the original approved volunteer record
   - Allows quick comparison of data differences

5. **Add "Apply Changes" action**:
   - Button to merge updated data to the original volunteer record
   - Confirmation dialog showing what will change
   - After applying, delete the duplicate record

6. **Table columns for Duplicates tab**:
   - Name (from new submission)
   - Email
   - Original Volunteer (link)
   - Events Registered (new submission)
   - Submitted At
   - Actions (View Details, Apply Changes, Delete)

---

### Part 5: Merge/Apply Changes Flow

**New webhook action: `apply_duplicate_changes`**

When admin clicks "Apply Changes":
1. Fetch original volunteer record by `created_user_id`
2. Show side-by-side comparison dialog
3. Admin selects which fields to update
4. Update the original `pending_volunteers` record
5. Optionally update `events_list` / `events_json` to add new events
6. Delete the duplicate record
7. Show success message

---

## Data Flow Diagram

```text
User submits form with existing email
            │
            ▼
   ┌─────────────────────┐
   │ webhook-receiver    │
   │ checks for existing │
   │ approved record     │
   └─────────────────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
 New User      Duplicate
    │               │
    ▼               ▼
 Create         Store with
 account        status='duplicate'
    │               │
    ▼               ▼
 Welcome       Duplicate
 Email         Notification Email
    │               │
    ▼               ▼
 Partner       Duplicates Tab
 Volunteers    (for admin review)
 Tab
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/webhook-receiver/index.ts` | Add duplicate detection logic, duplicate record creation, duplicate email function |
| `src/components/admin/PendingVolunteers.tsx` | Add "Duplicates" tab, count query, apply changes dialog, merge functionality |

---

## Edge Cases Handled

1. **Same email, different events**: Store new events for admin to merge
2. **Same email, updated phone/contact info**: Admin can apply changes
3. **Multiple duplicate submissions**: Each creates a separate duplicate record
4. **User receives confirmation**: Always gets an email explaining the situation

---

## Testing Checklist

After implementation:
- [ ] Submit form with new email → Creates approved record, sends welcome email
- [ ] Submit same email again → Creates duplicate record, sends notification email
- [ ] Admin can see duplicate in new tab with count badge
- [ ] Admin can view original volunteer from duplicate record
- [ ] Admin can apply changes from duplicate to original
- [ ] Duplicate record is deleted after applying changes
- [ ] Email notification follows DH branding guidelines
