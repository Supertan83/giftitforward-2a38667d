

# Add Marketplace Filter to Volunteer Export

## What This Does
Adds a marketplace dropdown to the existing "Export Volunteer Report" dialog, letting admins filter exported volunteers by a specific marketplace event. This sits between the date pickers and the format selector, matching the dialog layout shown in your screenshot.

## How It Will Look
- A new "Marketplace" dropdown appears after the End Date picker
- Options include "All Marketplaces" (default) plus every marketplace event from the database
- When a marketplace is selected, only volunteers registered for that event are included in the export
- The filename includes the marketplace name when filtered (e.g., `volunteers-report-event-7-cda-2026-02-01-to-2026-02-22.xlsx`)

## Technical Details

### Changes to `src/components/admin/PendingVolunteers.tsx`

**New state variable:**
- `exportMarketplace` -- stores the selected marketplace ID (or `'all'`)

**New data fetch:**
- Query `marketplace_events` table for `id` and `name`, ordered by `event_date` descending
- Used to populate the marketplace dropdown in the export dialog

**Export dialog update (UI):**
- Add a `Select` dropdown between End Date and Export Format sections
- Label: "Marketplace"
- First option: "All Marketplaces" (value `'all'`)
- Remaining options: each marketplace event by name

**Export handler update (logic):**
- When a marketplace is selected (not `'all'`), look up the marketplace name and normalize it to a slug
- Filter the query results: only include volunteers whose `events_list` contains a matching slug for the selected marketplace
- The filtering is done client-side after fetch since `events_list` is a comma-separated text field and needs fuzzy slug matching (same normalization pattern used elsewhere in the codebase)
- Include marketplace name in the export filename

**Summary line update:**
- When a marketplace is selected, the info text changes to: "Export will include volunteers from [date] to [date] for [marketplace name]"

### No other files need changes
- No database changes needed
- No new components needed -- uses existing `Select` UI component
