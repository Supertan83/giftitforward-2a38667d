

## Email Campaign Manager: Send Templates to Volunteers (Manual + Scheduled)

### Overview
Add a new "Email Campaigns" section in the Admin Dashboard that allows admins to:
1. Select any custom template from the Email Template Center
2. Choose recipients (all approved volunteers, specific marketplace, or manual selection)
3. Send immediately (manual trigger) or schedule for a future date/time
4. Track campaign status and delivery progress

### Database Changes

**New table: `email_campaigns`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| template_id | uuid (FK -> email_templates) | Selected template |
| name | text | Campaign name |
| recipient_filter | jsonb | Filter criteria (e.g. `{type: "all"}`, `{type: "marketplace", id: "..."}`, `{type: "manual", emails: [...]}`) |
| scheduled_at | timestamptz (nullable) | Null = manual send only |
| sent_at | timestamptz (nullable) | When actually sent |
| status | text | `draft`, `scheduled`, `sending`, `sent`, `failed` |
| total_recipients | int | Count of recipients |
| sent_count | int | Successfully sent count |
| failed_count | int | Failed count |
| created_by | uuid | Admin who created it |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**New table: `email_campaign_recipients`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| campaign_id | uuid (FK -> email_campaigns) | |
| volunteer_id | uuid (nullable) | FK to pending_volunteers |
| recipient_email | text | |
| recipient_name | text | |
| status | text | `pending`, `sent`, `failed` |
| error_message | text (nullable) | |
| sent_at | timestamptz (nullable) | |
| created_at | timestamptz | |

RLS: Admin-only for both tables.

### New Edge Function: `send-campaign-email`

Handles both manual triggers and scheduled execution:
- Accepts a `campaign_id`
- Loads the campaign, template, and recipients
- Iterates through pending recipients, renders the template with token replacement per recipient (using their `first_name`, `last_name`, `email`, linked marketplace data)
- Sends via Resend (using the existing branded HTML wrapper from `send-test-email`)
- Updates each recipient's status and the campaign's `sent_count`/`failed_count`
- Logs each send to `email_send_logs`

### Scheduled Execution via pg_cron

A cron job (every 5 minutes) that:
```sql
SELECT campaigns with status = 'scheduled' AND scheduled_at <= now()
```
For each, calls the `send-campaign-email` edge function.

### New UI Component: `EmailCampaignManager.tsx`

Added as a new admin view accessible from the sidebar.

**Sections:**
1. **Campaign List** -- Table showing all campaigns with status badges, recipient counts, scheduled time, and actions (Send Now, Edit, Delete)
2. **Create/Edit Campaign Dialog** with:
   - Campaign name
   - Template selector (dropdown of active templates from `email_templates`)
   - Recipient selector:
     - "All approved volunteers" -- queries `pending_volunteers` where `status = 'approved'`
     - "By marketplace" -- select a marketplace, filters volunteers by `events_list` or `events_json`
     - "Manual list" -- paste/type email addresses
   - Schedule toggle: immediate or pick a date/time
3. **Campaign Detail View** -- Shows per-recipient delivery status (sent/failed/pending)

### Files to Create
- `src/components/admin/EmailCampaignManager.tsx` -- Main UI component
- `supabase/functions/send-campaign-email/index.ts` -- Edge function for sending

### Files to Modify
- `src/components/admin/AdminDashboard.tsx` -- Add `email-campaigns` to AdminView type and render the new component
- `src/components/admin/AdminSidebar.tsx` -- Add "Email Campaigns" menu item under the communications section
- `supabase/config.toml` -- Add `[functions.send-campaign-email]` with `verify_jwt = false`

### Technical Flow

```text
Admin creates campaign:
  1. Selects template + recipients + schedule
  2. Saves to email_campaigns + email_campaign_recipients

Manual trigger (Send Now):
  Admin clicks "Send Now" -> calls send-campaign-email edge function

Scheduled trigger:
  pg_cron (every 5 min) -> checks for due campaigns -> calls send-campaign-email

send-campaign-email:
  1. Load campaign + template
  2. For each pending recipient:
     a. Replace tokens ({{first_name}}, etc.) using pending_volunteers data
     b. Render branded HTML
     c. Send via Resend
     d. Update recipient status
  3. Update campaign totals + status to 'sent'
```

