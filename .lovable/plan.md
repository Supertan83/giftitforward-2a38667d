

# Fix Survey Excel Export — Missing Data and Column Cleanup

## Issues Found

1. **Marketplace Name empty**: 150/154 internal surveys DO have `marketplace_id` and should resolve. 55 external surveys have NO `marketplace_id` at all — this is a data gap. The edge function logic is correct, so the empty values in the screenshot likely came from a deployment timing issue or external surveys without marketplace links.

2. **Volunteer Email empty**: All 154 internal surveys have emails in the database. Same likely deployment timing issue — the fields are being returned correctly in the current code.

3. **Columns to remove**: Organisation Name, One-word GIF Experience, Future Participation — user confirmed these are redundant since they appear as dynamic question answers already.

4. **Volunteer Hours**: Already included but may show empty for external volunteers (no card link).

## Changes

### 1. `SurveyReviewsViewer.tsx` — Clean up Excel columns
Remove these columns from the `generateExcel` function:
- Organisation Name
- One-word GIF Experience  
- Future Participation
- Source

Keep: Survey Date, Marketplace Name, Volunteer Name, Volunteer Email, Volunteer Hours, then dynamic question columns.

### 2. `get-survey-reviews/index.ts` — Fallback marketplace resolution for internal surveys
For internal surveys where `marketplace_id` is null but `volunteer_card_id` exists, look up the marketplace from the volunteer card. This fills in a few more gaps.

### 3. Redeploy edge function
Ensure the latest version with all field mappings is active.

### Files
- `src/components/admin/SurveyReviewsViewer.tsx` — remove 4 columns from Excel export
- `supabase/functions/get-survey-reviews/index.ts` — add card-based marketplace fallback

