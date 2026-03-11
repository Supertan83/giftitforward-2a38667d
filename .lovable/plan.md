

# Add Excel/CSV Export to Survey Reviews

## What changes

### 1. Update edge function `get-survey-reviews` to return richer data
Currently it only selects `volunteer_name, completed_at, answers`. Expand the SELECT to include:
- `volunteer_email`
- `marketplace_id`
- `experience_word`
- `would_volunteer_again`
- `volunteer_card_id` (internal only, for hours lookup)
- `company_name` (external only)

Also join/resolve:
- `marketplace_events` → marketplace name from `marketplace_id`
- `volunteer_qr_cards` → `total_hours_worked` from `volunteer_card_id` (internal surveys)

Return these extra fields in each survey result object.

### 2. Update `SurveyReviewsViewer.tsx` — add "Download Excel" button
- Add an "Export Excel" button next to the existing "Download All" (PDF) button
- Use the existing `xlsx` package (already installed) to generate a workbook
- Each row contains the columns from the screenshot:

| Column | Source |
|---|---|
| Survey Date | `completedAt` |
| Marketplace Name | resolved from `marketplace_id` |
| Volunteer Name | `name` |
| Volunteer Email | `email` |
| Organisation Name | `company` (external) or "Dubai Holding" (internal employee) |
| Favorite Part | answer mapped to the relevant question |
| Areas for Improvement | `improvement_suggestions` or mapped answer |
| Future Participation | `wouldVolunteerAgain` (Yes/No) |
| One-word GIF Experience | `experienceWord` |
| Volunteer Hours | `totalHours` |

Plus dynamic question columns from `answers` JSONB.

### Files to modify
- `supabase/functions/get-survey-reviews/index.ts` — expand query fields, join marketplace name and hours
- `src/components/admin/SurveyReviewsViewer.tsx` — add Excel export button using `xlsx`, update interface

