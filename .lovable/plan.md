

# Show Family Members Names and Certification Status in Volunteer List

## What Changes

In the "Volunteers Added" section (approved tab), the current "Family" column only shows a number (e.g., "3"). This will be expanded so that clicking/expanding a volunteer row reveals the actual family member names and their certificate status underneath.

## How It Will Work

1. **Expandable family row**: Each volunteer row with family members will have a small expand/collapse toggle (chevron icon) in the Family column. Clicking it reveals sub-rows below the volunteer showing each family member's name and certificate status.

2. **Family member name resolution**: Uses the same positional fallback logic already implemented -- extracts dependents from `events_json`, matches them to QR cards by F-index, falls back to positional matching.

3. **Certificate status display**: Each family member row will show a badge indicating whether their attendance certificate has been sent (using the `certificate_sent_at` field from `volunteer_qr_cards`).

## Technical Details

### 1. Update the data query in `PendingVolunteers.tsx`

The current query fetches `volunteer_qr_cards` with only `unique_id` and `status`. Add `id`, `certificate_sent_at`, `survey_completed_at`, `checked_in_at`, and `checked_out_at` to enable displaying certificate info for family cards.

### 2. Update `VolunteerQRCard` interface

Add the new fields (`id`, `certificate_sent_at`, `survey_completed_at`) to the `VolunteerQRCard` interface.

### 3. Add expandable family rows in the approved tab table

- Add state `expandedVolunteers` (a `Set<string>`) to track which volunteer rows are expanded
- In the "Family" column cell, make the count clickable (toggle expand)
- After each volunteer `<motion.tr>`, render additional sub-rows for family members when expanded:
  - Family member name (resolved via dependents + positional fallback)
  - Certificate status badge (Sent / Not Sent)
  - QR card ID shown as a small tag

### 4. Column width adjustments

Minor adjustment to accommodate the expanded content -- the family column gets slightly wider and sub-rows span the full table width.

## Files to Change

1. **`src/components/admin/PendingVolunteers.tsx`**
   - Update `VolunteerQRCard` interface to include `id` and `certificate_sent_at`
   - Update the Supabase query to fetch these extra fields
   - Add `expandedVolunteers` state
   - Add expand toggle to the Family column cell
   - Render family member sub-rows with names and certificate badges when expanded
