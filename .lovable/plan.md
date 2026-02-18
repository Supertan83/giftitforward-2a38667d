

## CDA Volunteer Survey -- Auto-Create Volunteer Profile on Submission

### Overview
When a CDA volunteer submits the external survey at `/survey`, the system will automatically create their volunteer account if one doesn't already exist, and link the survey response to their profile. This ensures every CDA survey respondent is captured in the GIF volunteer system.

### Current Flow
1. CDA volunteer receives SMS with link to `gif.thesurpluss.com/survey`
2. They enter name, email, and answer survey questions
3. The `submit-external-survey` edge function saves data to `external_survey_responses` table
4. A participation certificate is generated and emailed

### New Flow (additions in bold)
1. CDA volunteer receives SMS with link to `gif.thesurpluss.com/survey`
2. They enter name, email, and answer survey questions
3. The `submit-external-survey` edge function:
   - Saves data to `external_survey_responses` table (existing)
   - **Checks if a user with this email already exists in `auth.users`**
   - **If NOT: creates a new auth user + `pending_volunteers` record with status `approved` and source `cda_survey`**
   - **If YES: updates the existing `pending_volunteers` record to note the survey completion**
   - **Links the survey response ID to the volunteer profile**
4. A participation certificate is generated and emailed

### What Changes

#### 1. Edge Function: `submit-external-survey` (modified)

After saving the survey response, add auto-registration logic:

- **Check existing user**: Query `auth.users` by email using the admin client
- **If new volunteer**:
  - Create auth user with `supabase.auth.admin.createUser()` (auto-confirmed, random password)
  - Insert into `pending_volunteers` with: first_name, last_name, email, status = `approved`, source = `cda_survey`
  - Insert into `user_roles` with role = `volunteer`
  - Generate a volunteer QR card (`volunteer_qr_cards`) for tracking
- **If existing volunteer**:
  - No new account created (skip silently)
- **In both cases**: Update the `external_survey_responses` record with a reference to the volunteer (store `created_user_id` or email linkage)

The function already runs with the service role key, so it has the permissions needed to create auth users.

#### 2. Database: Add column to `external_survey_responses`

Add `volunteer_user_id UUID DEFAULT NULL` column to link survey responses to volunteer profiles for traceability.

#### 3. No UI Changes Needed

The survey page (`ExternalSurveyPage.tsx`) stays exactly the same -- the volunteer doesn't see any difference. The auto-registration happens silently in the backend.

### Technical Details

**Edge function logic (pseudo-code):**
```
// After saving survey response...

// 1. Check if user exists
const { data: existingUsers } = await supabase.auth.admin.listUsers()
// Filter by email match

// 2. If not exists, create account
if (!existingUser) {
  const nameParts = volunteer_name.split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ')
  const tempPassword = generateRandomPassword()
  
  // Create auth user (auto-confirmed)
  const { data: newUser } = await supabase.auth.admin.createUser({
    email, password: tempPassword, 
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName }
  })
  
  // Create pending_volunteers record
  await supabase.from('pending_volunteers').insert({
    email, first_name: firstName, last_name: lastName,
    status: 'approved', source: 'cda_survey',
    created_user_id: newUser.user.id
  })
  
  // Create volunteer QR card
  await supabase.from('volunteer_qr_cards').insert({
    volunteer_id: newUser.user.id,
    unique_id: generateQRCode(),
    status: 'inactive'
  })
}

// 3. Link survey response to user
await supabase.from('external_survey_responses')
  .update({ volunteer_user_id: userId })
  .eq('id', surveyResponseId)
```

**Files modified:**
- `supabase/functions/submit-external-survey/index.ts` -- add auto-registration logic
- Database migration -- add `volunteer_user_id` column to `external_survey_responses`

**Security notes:**
- The auto-created account uses a random password (the volunteer won't need to log in -- this is for data linkage)
- The `pending_volunteers` record is created with `approved` status since CDA has already vetted them
- Duplicate submissions with the same email are handled gracefully (no duplicate accounts)
