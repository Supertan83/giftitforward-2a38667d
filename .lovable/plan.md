

# Add Edit Button to Volunteer List in Marketplace Reports

## The Problem
Some volunteers forget to scan out on the correct day, resulting in inflated hours (e.g., 37.7h or 38.1h instead of ~4h). This skews the volunteer hours in marketplace reports and demographics.

## The Solution
Add an "Edit" button (pencil icon) next to each volunteer row in the Volunteer List table. Clicking it opens a dialog where the admin can manually correct:
- **Check-in time** (date and time)
- **Check-out time** (date and time)
- **Hours worked** (auto-calculated from the times, or manually overridden)

Changes save directly to the `volunteer_qr_cards` table in the database.

## Technical Details

### 1. Update `MarketplaceReports.tsx`
- Add a 6th column "Actions" to the volunteer list table (both desktop and mobile)
- Add a pencil/edit icon button in each row
- Import and render a new `VolunteerHoursEditDialog` component
- Track which volunteer card is being edited via local state
- The volunteer list data needs to include the `cardId` -- update the data shape to pass it through

### 2. Update `useMarketplaceAllocations.ts` (volunteer list builder)
- Include `card.id` (the volunteer_qr_cards ID) and `checked_in_at` / `checked_out_at` in the `volunteerList` array so the edit dialog can reference and pre-fill the correct record

### 3. Create new component `src/components/admin/VolunteerHoursEditDialog.tsx`
- A dialog with:
  - Volunteer name displayed (read-only)
  - Check-in date/time input (pre-filled from current data)
  - Check-out date/time input (pre-filled from current data)
  - Hours worked (auto-calculated when both times are set, with option to override)
- On save: updates `volunteer_qr_cards` table with new `checked_in_at`, `checked_out_at`, and `total_hours_worked`
- Invalidates the `marketplace_report` query cache so the table refreshes immediately

### 4. Column layout adjustment
- Adjust the `colgroup` widths to accommodate the new narrow Actions column
- Desktop: Name 25%, Category 16%, Company 16%, Status 16%, Hours 14%, Actions 13%

### No database changes needed
The `volunteer_qr_cards` table already has `checked_in_at`, `checked_out_at`, and `total_hours_worked` columns. Staff already have UPDATE permission via the existing RLS policy "Staff can manage volunteer cards".

