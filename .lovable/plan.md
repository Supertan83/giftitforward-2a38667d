

## Marketplace Soft Delete System

### Overview
Add a `deleted_at` column to all relevant tables, create a new "Marketplace Deletion" admin page accessible from the sidebar, and build a UI that lets the admin select a marketplace, preview impacted data stats, confirm, and soft-delete the marketplace along with all related records.

### Step 1 — Database Migration: Add `deleted_at` to all tables

Add a `deleted_at TIMESTAMPTZ DEFAULT NULL` column to every public table that holds user/event data. Tables to update:

`marketplace_events`, `qr_cards`, `transactions`, `marketplace_item_allocations`, `marketplace_manual_counts`, `archived_card_data`, `allocation_traceability_logs`, `volunteer_qr_cards`, `volunteer_attendance`, `pending_volunteers`, `pending_beneficiaries`, `item_types`, `partner_registrations`, `registration_events`, `event_dependents`, `external_survey_responses`, `volunteer_surveys`, `email_send_logs`, `email_campaigns`, `email_campaign_recipients`, `email_automations`, `email_automation_logs`, `email_templates`, `outreach_partners`, `warehouse_returns`, `surpluss_allocation_sync`, `surpluss_distribution_reports`, `surpluss_api_audit_log`, `cleanup_archive`, `survey_questions`, `hubspot_email_config`, `email_provider_config`, `external_items`, `external_companies`, `external_addresses`, `external_material_groups`, `external_sdg_goals`, `external_item_sdg_goals`, `webhook_events`, `webhook_mapping_templates`

Single migration with one `ALTER TABLE ... ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL` per table.

### Step 2 — Edge Function: `soft-delete-marketplace`

New edge function that:
1. Validates admin role
2. Accepts `{ marketplace_id: string }`
3. Uses service role client to set `deleted_at = now()` on:
   - `marketplace_events` where `id = marketplace_id`
   - `qr_cards` where `marketplace_id = marketplace_id`
   - `transactions` where `marketplace_id = marketplace_id`
   - `marketplace_item_allocations` where `marketplace_id = marketplace_id`
   - `marketplace_manual_counts` where `marketplace_id = marketplace_id`
   - `archived_card_data` where `marketplace_id = marketplace_id`
   - `allocation_traceability_logs` where `marketplace_id = marketplace_id`
   - `volunteer_qr_cards` where `marketplace_id = marketplace_id`
   - `volunteer_attendance` where `marketplace_id = marketplace_id`
   - `external_survey_responses` where `marketplace_id = marketplace_id`
   - `warehouse_returns` where `marketplace_id = marketplace_id` (if column exists)
4. Returns counts of affected rows per table

### Step 3 — Edge Function: `marketplace-deletion-preview`

New edge function (or combine into the same function with `mode: 'preview'`) that:
1. Accepts `{ marketplace_id: string }`
2. Counts rows per related table (without modifying)
3. Returns stats like `{ qr_cards: 1107, transactions: 5420, allocations: 12, ... }`

### Step 4 — New Component: `MarketplaceDeletion.tsx`

Located at `src/components/admin/MarketplaceDeletion.tsx`:
- Dropdown to select a marketplace (from `marketplace_events` where `deleted_at IS NULL`)
- On selection, calls preview endpoint and shows a stats card:
  - QR Cards count
  - Transactions count
  - Allocations count
  - Archived cards count
  - Traceability logs count
  - Volunteer cards/attendance count
  - Survey responses count
- "Delete Marketplace" button → confirmation dialog requiring typing marketplace name
- On confirm, calls soft-delete endpoint
- Success toast with summary

### Step 5 — Sidebar & Dashboard Wiring

- Add `'marketplace-deletion'` to the `AdminView` type in both `AdminSidebar.tsx` and `AdminDashboard.tsx`
- Add menu item under **Admin Apps** section with a `Trash2` icon and label "Marketplace Deletion"
- Add the component render case in the dashboard's view switcher

### Step 6 — Update Existing Queries

Update key data-fetching hooks to filter `deleted_at IS NULL`:
- `useMarketplaces()` in `useSupabaseData.ts` — add `.is('deleted_at', null)` to marketplace queries
- Other hooks that list marketplaces for dropdowns

This ensures soft-deleted marketplaces disappear from the UI without being permanently removed from the database.

### Technical Notes
- The `deleted_at` column approach keeps data in place; no data moves between tables
- All existing RLS policies continue to work — `deleted_at` is just a filter
- Future: a "Recycle Bin" view could list soft-deleted marketplaces with a restore option
- The `transactions` table currently has no UPDATE RLS policy, so the edge function uses the service role client to bypass this

