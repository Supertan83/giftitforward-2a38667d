

# Fix: Volunteer Certificate Email Missing Marketplace Details

## Problem
Family member attendance certificate emails include marketplace name, date, time, and hours worked. Volunteer attendance certificate emails do not — they skip straight to "Your Certificate of Attendance is attached." This is because `marketplaceId` and `hoursWorked` are not passed when calling `send-certificate` from the survey pages.

## Root Cause
Two gaps in the data flow:

1. **`submit-survey` edge function** (GET action): Returns only `id, volunteer_name, volunteer_email, volunteer_card_id, completed_at, certificate_sent_at` — missing `marketplace_id`.
2. **`VolunteerSurveyPage.tsx` and `ExternalSurveyPage.tsx`**: The `sendCertificateEmail` functions don't pass `marketplaceId` or `hoursWorked` to `send-certificate`.

## Changes

### 1. `supabase/functions/submit-survey/index.ts`
- Add `marketplace_id` to the select clause on line 38
- Also join `volunteer_qr_cards` to get `total_hours_worked` via a second query using `volunteer_card_id`, OR simply add `marketplace_id` to the returned survey data and let the client look up hours from the QR card

Simplest approach: just add `marketplace_id` to the select. For hours, do a quick lookup on `volunteer_qr_cards` using `volunteer_card_id` and return `hours_worked` alongside the survey data.

### 2. `src/pages/VolunteerSurveyPage.tsx`
- Update `SurveyData` interface to include `marketplace_id` and `hours_worked`
- Pass `marketplaceId` and `hoursWorked` to `send-certificate` invocation (lines 187-194)

### 3. `src/pages/ExternalSurveyPage.tsx`
- Same pattern: fetch marketplace_id from the survey/card data and pass it to `send-certificate`
- Need to check how this page gets its data (it uses a different flow)

### 4. No changes to `send-certificate` edge function
It already supports `marketplaceId` and `hoursWorked` parameters and renders the participation details block when they're present.

## Summary
- 1 edge function edit (add `marketplace_id` + hours lookup to survey GET response)
- 2 frontend edits (pass the new fields through to `send-certificate`)

