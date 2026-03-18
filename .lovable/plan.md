

# Fix: Send Reminder button should use admin-created email template

## Problem
The "Send Reminder" button currently calls `send-retake-training` edge function which has a hardcoded email template. Instead, it should use the campaign email infrastructure (same as bulk send) so it sends using the admin-created template from the Email Templates section.

## Solution
Replace the current `sendReminderMutation` with a flow that:
1. When admin clicks "Send Reminder", show a small dialog to pick an email template
2. On confirm, create a single-recipient campaign using that template and invoke `send-campaign-email`

This reuses the same campaign infrastructure as the bulk send feature, ensuring token resolution (`{{full_name}}`, `{{email}}`, `{{password}}`, etc.) and CTA buttons work correctly with admin-designed templates.

## Changes

### `src/components/admin/PendingVolunteers.tsx`
- Import `useEmailTemplates` from the existing hook
- Add state: `reminderDialogVolunteer` (the volunteer to send to), `reminderTemplateId` (selected template)
- Replace `sendReminderMutation` to create a 1-recipient campaign + invoke `send-campaign-email` (same pattern as bulk send in `TrainingCompletionViewer`)
- Change the "Send Reminder" dropdown item to open the template picker dialog instead of sending immediately
- Add a small dialog with template dropdown + confirm button

