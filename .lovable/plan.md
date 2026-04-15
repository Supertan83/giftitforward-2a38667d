
Goal: fix the /register volunteer flow so QR cards are actually linked to the volunteer, show the volunteer’s name instead of “Unassigned”, and stop welcome/resend emails from showing “N/A”.

What I found
- `src/App.tsx` maps `https://gif.thesurpluss.com/register` to `OnsiteRegistrationPage`.
- `src/pages/OnsiteRegistrationPage.tsx` calls the edge function `register-onsite-volunteer`.
- In `supabase/functions/register-onsite-volunteer/index.ts`, the QR card is created with `volunteer_id: null` before the `pending_volunteers` row is created.
- Because of that:
  - admin QR views show the card as `Unassigned`
  - scanner/check-in flow can find the QR by `unique_id`, but the card is not tied to a volunteer profile
  - any UI/report that relies on `volunteer_id -> pending_volunteers` treats the volunteer as missing/inactive/unassigned
- Separately, `supabase/functions/webhook-receiver/index.ts` still has a legacy `sendWelcomeEmail(...)` helper that hardcodes `'N/A'` as the QR ID, so some resend/legacy paths can still produce “N/A” in emails.

Implementation plan
1. Fix the `/register` edge function
- Update `supabase/functions/register-onsite-volunteer/index.ts` to:
  - create the auth user
  - create the `pending_volunteers` row first and return its `id`
  - then create `volunteer_qr_cards` with `volunteer_id` set to that pending volunteer id
  - ideally also set `marketplace_id` at creation time for the selected marketplace
- Add proper error handling so if QR card creation fails after user creation, the function does not silently leave partial/broken registration state.

2. Fix email QR ID fallback
- Update the legacy `sendWelcomeEmail(...)` wrapper in `supabase/functions/webhook-receiver/index.ts` so it no longer passes `'N/A'`.
- Make it look up the volunteer’s real primary QR card by `pending_volunteer_id` before delegating to `sendWelcomeEmailWithQR(...)`.
- This prevents future resends/legacy flows from sending “QR Card ID: N/A”.

3. Clean up already-broken registrations
- Run a one-time data repair for existing `/register` volunteers whose QR cards were created as orphaned/unassigned.
- Match orphaned `volunteer_qr_cards` records to their `pending_volunteers` records and backfill `volunteer_id`.
- If safe from the existing data shape, also backfill `marketplace_id` where it is clearly derivable from the registration.
- This is a data update, not a schema change.

4. Verify affected UI behavior
- Confirm these views now resolve the volunteer correctly:
  - scanner/check-in flow
  - admin volunteer QR cards list / print preview
  - any volunteer attendance/reporting screens that depend on linked volunteer data
- No UI redesign needed unless a follow-up issue appears after the linkage fix.

Technical notes
- No schema change is required.
- Main code files to update:
  - `supabase/functions/register-onsite-volunteer/index.ts`
  - `supabase/functions/webhook-receiver/index.ts`
- Main data issue:
  - orphaned rows in `volunteer_qr_cards` where `volunteer_id IS NULL`
- Existing read patterns already expect linked records, e.g.:
  - `VolunteerQRCardsViewer` joins `volunteer:pending_volunteers(...)`
  - `useVolunteerCheckInStatus` looks up cards by `volunteer_id`
- This strongly confirms the root cause is the broken link, not just a label problem.

Expected outcome
- New volunteers registering via `/register` get a QR card linked to their volunteer profile.
- Admin screens show their actual name instead of `Unassigned`.
- Scanner/check-in and reporting work against a real volunteer record.
- Welcome/resend emails stop showing “N/A” for QR card ID.
- Existing broken registrations can be repaired in one cleanup pass.
