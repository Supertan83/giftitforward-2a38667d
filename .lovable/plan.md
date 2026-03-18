

# Bulk Send Training Reminder from Training Completion Tab

## What to build

Add a "Bulk Send Reminder" button to the Training Completion tab that lets admins send a training reminder email to all pending volunteers at once, using the existing campaign email infrastructure (template selection + `send-campaign-email` edge function).

## How it works

1. **New button** in `TrainingCompletionViewer.tsx` — visible when the "Pending" filter is active (or always visible near the filter bar). Shows count: "Send Reminder to 523 Pending".

2. **Template picker dialog** — when clicked, opens a dialog that:
   - Lets admin select an email template from the `email_templates` table (reuses `useEmailTemplates` hook)
   - Shows recipient count (number of pending volunteers)
   - Has a confirmation step before sending

3. **On confirm**, the component:
   - Creates a campaign in `email_campaigns` with `name: "Training Reminder - {date}"`, linking the selected template
   - Inserts all pending (not training_completed) volunteers as `email_campaign_recipients`
   - Invokes `send-campaign-email` edge function with the campaign ID
   - Shows progress toast and updates UI on completion

4. **No new edge functions needed** — reuses the existing `send-campaign-email` function which already handles bulk sends with rate limiting, token resolution (`{{full_name}}`, `{{email}}`, `{{password}}`, CTA buttons), and per-recipient status tracking.

## Changes

### `src/components/admin/TrainingCompletionViewer.tsx`
- Import `useEmailTemplates` hook and `Select` components
- Add state for bulk send dialog (open, selected template, sending status)
- Add "Send Reminder to X Pending" button next to the filter buttons
- Add a dialog with template dropdown, recipient count summary, and Send/Cancel buttons
- On send: create campaign + recipients via Supabase client, then invoke `send-campaign-email`
- Show success/failure toast with sent/failed counts from the response

### No backend changes
The existing `send-campaign-email` edge function already supports everything needed — template-based emails with full token resolution and volunteer data lookup.

