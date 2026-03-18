

# Add Survey Status Column to Volunteers Added Export

## What Changes

Add a "Survey Status" column to the volunteer export in `PendingVolunteers.tsx` that shows whether attended volunteers completed a survey for the relevant marketplace.

## How It Works

**Data source**: The export already fetches `volunteer_qr_cards` with `survey_completed_at` and `marketplace_id`. However, `survey_completed_at` on the card is the most reliable indicator. We'll also fetch from `volunteer_surveys` table as a fallback to catch surveys submitted independently.

**Logic**:
- Volunteer status is "Attended" (card `checked_out`) → compute survey status
- `survey_completed_at` exists on their volunteer card → **Yes**
- Otherwise, check `volunteer_surveys` table by email + marketplace_id → **Yes** if found
- Otherwise, check `external_survey_responses` table by email + marketplace_id → **Yes** if found  
- No match → **No**
- Volunteer not attended → leave blank

## File: `src/components/admin/PendingVolunteers.tsx`

### 1. Fetch survey data before building rows (~line 1074)
After fetching family cards, add two queries:
```typescript
// Fetch completed surveys for matching
const { data: completedSurveys } = await supabase
  .from('volunteer_surveys')
  .select('volunteer_email, marketplace_id, completed_at')
  .not('completed_at', 'is', null);

const { data: externalSurveys } = await supabase
  .from('external_survey_responses')  
  .select('volunteer_email, marketplace_id, completed_at')
  .not('completed_at', 'is', null);

// Build a Set of "email|marketplace_id" keys for O(1) lookup
const surveyCompletionSet = new Set<string>();
for (const s of (completedSurveys || [])) {
  if (s.volunteer_email && s.marketplace_id) {
    surveyCompletionSet.add(`${s.volunteer_email.toLowerCase()}|${s.marketplace_id}`);
  }
  // Also add email-only key for cases where marketplace isn't linked
  if (s.volunteer_email) {
    surveyCompletionSet.add(`${s.volunteer_email.toLowerCase()}|any`);
  }
}
for (const s of (externalSurveys || [])) {
  if (s.volunteer_email && s.marketplace_id) {
    surveyCompletionSet.add(`${s.volunteer_email.toLowerCase()}|${s.marketplace_id}`);
  }
  if (s.volunteer_email) {
    surveyCompletionSet.add(`${s.volunteer_email.toLowerCase()}|any`);
  }
}
```

### 2. Add header (line 1124)
Add `'Survey Status'` after `'Attendance Status'` in the headers array.

### 3. Compute survey status per row (line 1154)
For primary volunteers:
```typescript
// Determine survey status for attended volunteers
let surveyStatus = '';
if (primaryAttended) {
  const cardWithSurvey = primaryCards?.find(c => c.status === 'checked_out' && !/-F\d+/.test(c.unique_id) && c.survey_completed_at);
  if (cardWithSurvey) {
    surveyStatus = 'Yes';
  } else {
    // Check by email + marketplace
    const email = v.email?.toLowerCase();
    const mktId = primaryCards?.find(c => c.status === 'checked_out' && !/-F\d+/.test(c.unique_id))?.marketplace_id;
    if (email && mktId && surveyCompletionSet.has(`${email}|${mktId}`)) {
      surveyStatus = 'Yes';
    } else if (email && surveyCompletionSet.has(`${email}|any`)) {
      surveyStatus = 'Yes';
    } else {
      surveyStatus = 'No';
    }
  }
}
```

For family members: use `fc.survey_completed_at ? 'Yes' : (familyAttended ? 'No' : '')`.

### 4. Update rows array and column widths
Add `surveyStatus` to each row after the attendance status column. Add corresponding `{ wch: 15 }` for column width. Update summary row padding to match new column count.

### 5. Update all `Array(headers.length).fill('')` references
The summary rows use hardcoded arrays — update to match new column count (16 instead of 15).

