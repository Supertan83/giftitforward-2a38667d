

# Plan: Add "Pending (Missing Email)" Tab to Admin Dashboard

## Problem Summary
Webflow form submissions from Dubai Holding employees are arriving without email addresses. The webhook-receiver creates records in `pending_volunteers` with placeholder emails (e.g., `missing_email_...@placeholder.invalid`) and status = 'pending'. However, the Admin Dashboard's "Volunteers Added" section only shows volunteers with status = 'approved', making these 46 pending records invisible to administrators.

## Solution Overview
Add a new "Pending (Missing Email)" tab to the Volunteers Added section that displays volunteers stuck in pending status due to missing emails, and provides functionality to:
1. View all pending volunteers with their details
2. Add/edit the missing email address
3. Trigger account creation, QR code generation, and welcome email sending

## Implementation Steps

### 1. Update PendingVolunteers Component UI
**File: `src/components/admin/PendingVolunteers.tsx`**

- Add a third tab called "Pending (Missing Email)" to the existing tabs
- Update the tab state type to include `'pending_missing_email'`
- Add query logic to fetch volunteers where `status = 'pending'`
- Display a count badge on the tab showing how many need attention
- Render a specialized table for pending volunteers with:
  - Name, phone, events registered for
  - "Add Email" action button
  - Delete action (to remove invalid records if needed)

### 2. Create "Add Email" Dialog
**File: `src/components/admin/PendingVolunteers.tsx`**

- Add a dialog for entering the missing email address
- Include email validation (proper format)
- Show volunteer details for context (name, phone, events)

### 3. Create Backend Function to Process Email Addition
**File: `supabase/functions/webhook-receiver/index.ts`**

- Add new action `add_volunteer_email` that:
  1. Validates the email format
  2. Checks if email already exists in the system
  3. Updates the pending_volunteers record with the real email
  4. Triggers the auto-approval flow (creates user account, QR code, sends welcome email)
  5. Updates status from 'pending' to 'approved'

### 4. Add Mutation for Email Addition
**File: `src/components/admin/PendingVolunteers.tsx`**

- Create mutation to call the new `add_volunteer_email` action
- Handle success (refresh list, show credentials)
- Handle errors (email already exists, invalid format, etc.)

## Technical Details

### Tab Configuration
```text
+-------------------+------------------+---------------------------+
| Partner Volunteers | Bulk Uploaded   | Pending (Missing Email)   |
+-------------------+------------------+---------------------------+
```

### Database Query for Pending Tab
```sql
SELECT * FROM pending_volunteers 
WHERE status = 'pending' 
ORDER BY created_at DESC
```

### New Edge Function Action Structure
```text
Action: add_volunteer_email
Input:
  - pending_id: UUID
  - email: string (validated email address)

Process:
  1. Validate email format
  2. Check for duplicate email in pending_volunteers and auth.users
  3. Update pending_volunteers.email with real email
  4. Call existing auto-approve logic
  5. Return credentials + QR code

Output:
  - success: boolean
  - email: string
  - temp_password: string
  - qr_code: string
  - email_sent: boolean
```

### UI Table Columns for Pending Tab
| Name | Phone | Events | Created | Actions |
|------|-------|--------|---------|---------|
| First Last | 05xxxxx | Event Name | Date | [Add Email] [Delete] |

## Files to Modify
1. `src/components/admin/PendingVolunteers.tsx` - Add new tab and UI
2. `supabase/functions/webhook-receiver/index.ts` - Add email addition action

## Benefits
- Administrators can now see all 46 pending volunteers that were previously invisible
- Provides a workflow to manually add missing emails and complete registrations
- Maintains the existing auto-approval flow for consistency
- Keeps audit trail through the standard pending_volunteers table

