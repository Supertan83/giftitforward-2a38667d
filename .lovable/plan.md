
## Email Automation Workflows

### Overview
Add a new "Automations" tab inside the Email Campaigns manager where admins can create trigger-based workflows that automatically send email templates to specific recipients based on event timing (e.g., "Send follow-up email 2 days before marketplace to all marketplace volunteers").

### New Database Table: `email_automations`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Workflow name (e.g., "Pre-Marketplace Reminder") |
| template_id | uuid | FK to email_templates |
| trigger_type | text | `before_marketplace`, `after_marketplace`, `after_approval`, `after_training` |
| trigger_days | integer | Days before/after the trigger event (e.g., 2 = two days before) |
| trigger_time | time | Time of day to send (e.g., 09:00) |
| recipient_filter | jsonb | Who to target: `{type: "marketplace", marketplace_id: "..."}` or `{type: "all_upcoming"}` |
| is_active | boolean | Toggle on/off |
| last_run_at | timestamptz | Last execution timestamp |
| created_by | uuid | Admin who created it |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: Admin full access, staff read-only (matching existing email table patterns).

### New Database Table: `email_automation_logs`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| automation_id | uuid | FK to email_automations |
| campaign_id | uuid | FK to the auto-generated campaign |
| triggered_at | timestamptz | When the automation fired |
| recipients_count | integer | How many emails were queued |
| status | text | `success`, `failed`, `skipped` |
| notes | text | Details/errors |

### New Edge Function: `run-email-automations`

This function will be called on a schedule (via pg_cron, every hour). It will:

1. Query all active automations
2. For each automation, check if it should fire now:
   - `before_marketplace`: Find marketplace events where `event_date - trigger_days = today` and current time >= trigger_time
   - `after_marketplace`: Find marketplace events where `event_date + trigger_days = today`
   - `after_approval`: Find volunteers approved in the last `trigger_days` days who haven't received this automation
   - `after_training`: Find volunteers who completed training in the last `trigger_days` days who haven't received this automation
3. If triggered, auto-create a campaign with recipients, then invoke `send-campaign-email`
4. Log the run to `email_automation_logs`
5. Update `last_run_at` on the automation

### UI Changes

#### 1. Add "Automations" tab to EmailCampaignManager

The existing Campaigns/Logs tabs will get a third tab: **Automations**.

#### 2. Automation List View
- Table showing all automations with: Name, Template, Trigger (e.g., "2 days before marketplace"), Status (Active/Inactive toggle), Last Run
- "New Automation" button

#### 3. Create/Edit Automation Dialog
- **Name**: Text input
- **Template**: Dropdown of email templates
- **Trigger Type**: Select from:
  - "Before Marketplace" -- sends X days before a marketplace event_date
  - "After Marketplace" -- sends X days after
  - "After Volunteer Approval" -- sends X days after a volunteer is approved
  - "After Training Completion" -- sends X days after training is completed
- **Days**: Number input (0 = same day)
- **Time**: Time picker for when to send
- **Recipients**: 
  - All volunteers for upcoming marketplaces
  - Specific marketplace volunteers only
  - All approved volunteers (for non-marketplace triggers)
- **Active toggle**: Enable/disable

#### 4. Automation Logs
- Expandable rows or a sub-section showing run history per automation

### Cron Job Setup

A `pg_cron` job will call the `run-email-automations` edge function every hour to check and execute due automations. This will be set up via SQL insert (not migration) since it contains project-specific URLs.

### Files to Create/Modify

- **New migration**: Create `email_automations` and `email_automation_logs` tables
- **New file**: `supabase/functions/run-email-automations/index.ts` -- the scheduler logic
- **Modified**: `src/components/admin/EmailCampaignManager.tsx` -- add Automations tab with CRUD UI
- **Modified**: `src/components/admin/AdminSidebar.tsx` -- update AdminView type (no new sidebar item needed, automations live inside campaigns)

### Technical Details

The automation engine uses a "check and fire" pattern:
- Each hourly run checks `trigger_days` against marketplace `event_date` or volunteer timestamps
- To prevent duplicate sends, the system checks `email_automation_logs` for existing runs matching the same automation + marketplace/date combination
- The `recipient_filter` on automations works identically to campaign recipient filters, reusing the same volunteer lookup logic
- When an automation fires, it creates a real `email_campaign` record (with name prefixed "Auto:") so all existing campaign tracking, logs, and recipient status features work automatically
