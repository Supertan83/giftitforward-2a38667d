

## Add Company Name to Survey Excel Export

### Problem
The `company` field is already available in the survey data (returned by the `get-survey-reviews` edge function) but is not included in the Excel export columns.

### Change

**File: `src/components/admin/SurveyReviewsViewer.tsx`** — `generateExcel` function (line 74-79)

Add `'Company Name': survey.company` to the row object, placed after `Volunteer Email` and before `Volunteer Hours`.

