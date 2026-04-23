

## Plan: Bulk-edit volunteer hours in Marketplace Reports

### Where it goes
The "Volunteer List" table inside **Marketplace Reports** (`src/components/admin/MarketplaceReports.tsx`) — the same table that today has a per-row pencil (Edit) opening `VolunteerHoursEditDialog`. We'll keep the per-row edit and add a multi-select + bulk edit on top.

### UX

1. **Selection column**
   - Add a checkbox column on the left of every volunteer row (desktop table + mobile cards).
   - A "select all" checkbox in the header selects/deselects every volunteer in the currently displayed marketplace report.

2. **Bulk action bar** (appears above the table only when ≥1 row is selected)
   - Shows: `"3 volunteers selected"` + buttons: **Edit Hours**, **Clear**.
   - Click **Edit Hours** → opens a new bulk dialog.

3. **New `VolunteerBulkHoursEditDialog`** (`src/components/admin/VolunteerBulkHoursEditDialog.tsx`)
   - Lists the selected volunteer names (compact, scrollable).
   - One field set applied to ALL selected volunteers, with three modes (radio):
     - **Set hours to** — fixed numeric value (e.g. `5.0h`), overwrites `total_hours_worked`.
     - **Set check-in / check-out times** — two `datetime-local` inputs; hours auto-calculated from the duration (matches existing single-edit behavior).
     - **Clear hours** — sets hours to 0 and clears check-in/out timestamps.
   - Save button disabled while empty/invalid; shows progress (`Updating 2 / 5…`).

4. **Save behavior** (mirrors the existing single-edit logic)
   - For each selected `cardId`, update `volunteer_qr_cards`:
     - `total_hours_worked`, plus `checked_in_at` / `checked_out_at` when in time-mode.
   - For the currently selected marketplace, also update the matching `volunteer_attendance` row (latest by `check_in_time`) — same join that `VolunteerHoursEditDialog` already does.
   - Updates run sequentially with a small concurrency limit (e.g. 4 at a time) to keep the UI responsive.
   - On completion: toast `"Updated N volunteers"` (and a count of failures if any), invalidate `['marketplace_report']`, close dialog, clear selection.

### Files touched

- **NEW** `src/components/admin/VolunteerBulkHoursEditDialog.tsx` — the bulk dialog (built from the existing `VolunteerHoursEditDialog` pattern).
- **EDIT** `src/components/admin/MarketplaceReports.tsx`:
  - Add `selectedCardIds: Set<string>` state, scoped to the selected marketplace (cleared on marketplace change).
  - Add checkbox column + "select all" header to the desktop table and mobile cards.
  - Render the bulk-action bar above the Volunteer List when `selectedCardIds.size > 0`.
  - Mount `<VolunteerBulkHoursEditDialog />` next to the existing single-edit dialog.

### Out of scope
- No DB changes (uses existing `volunteer_qr_cards` + `volunteer_attendance` tables and current RLS — admins already have full access).
- No edge function needed; updates go through the Supabase client like the single-edit flow.
- No changes to the "Volunteers Added" tab (`PendingVolunteers.tsx`) — bulk hour edits only make sense per-marketplace context where check-in/out times live.

### Result
Admins can tick multiple volunteers in a marketplace report, click **Edit Hours**, and apply a single hours value or a check-in/out window to all of them at once — saving repeated single-edit clicks during post-event reconciliation.

