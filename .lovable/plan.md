

# Review Survey Section for Volunteer App

## What This Does
Adds a new "Review Survey" tab in the volunteer app's bottom navigation bar. Volunteers can browse all completed survey responses (both internal and external) grouped by respondent name, with their answers displayed in an expandable card format.

## How It Will Look

The bottom navigation bar will get a 4th tab with a clipboard icon labeled "Surveys". Tapping it shows a scrollable list of completed surveys, each as a card showing:
- Volunteer/respondent name
- Completion date
- Expandable section showing each question and their answer

A search bar at the top lets volunteers filter by name.

## Access Approach

Since volunteers don't have direct database access to survey tables, a new backend function will securely fetch completed surveys and return them without exposing sensitive tokens or IDs.

---

## Technical Details

### 1. New Backend Function: `get-survey-reviews/index.ts`

- Accepts GET requests with optional `search` query param
- Queries both `volunteer_surveys` and `external_survey_responses` where `completed_at IS NOT NULL`
- Also fetches `survey_questions` to map question IDs to question text
- Returns a unified list: `{ name, completedAt, source: 'internal'|'external', answers }` 
- Requires authenticated user with staff role (volunteers are staff via `is_staff`)
- Does NOT return survey tokens, emails, or IDs -- only name, date, and answers

### 2. New Component: `src/components/zones/ReviewSurveyZone.tsx`

- Calls the edge function on mount using `useQuery`
- Renders a search input and a list of survey cards
- Each card uses an Accordion to expand/collapse answers
- Maps answer keys to question text from `survey_questions`
- Shows "No surveys yet" empty state if none found

### 3. Update: `src/components/VolunteerInterface.tsx`

- Add `'surveys'` to the `Zone` type: `type Zone = 'entrance' | 'marketplace' | 'exit' | 'surveys'`
- Add a 4th item to the `zones` array with `ClipboardList` icon
- The surveys tab is always accessible (not zone-restricted) -- all volunteers can view it regardless of assigned zone
- Add `case 'surveys'` to `renderZone()` switch

### 4. No Database Changes Needed

Both tables already exist with the right data. The edge function reads using the service role key, so no RLS changes are needed.

