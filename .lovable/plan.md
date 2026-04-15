

## Fix: Exclude Inactive Volunteers from Attended Count

### Problem
The Volunteer Details and Volunteer Tracking sections count volunteers who signed up via the registration link but never checked in (QR card status: "Inactive") as part of the data. While the "Total Attended" logic correctly filters for `checked_in`/`checked_out`, the "Total Registered" count includes ALL approved volunteers who match the marketplace in `events_list` — even those who only signed up and never showed up. This inflates the registered count and makes the dropout rate misleadingly high.

Additionally, the `VolunteerTrackingSection.tsx` determines "attended" by checking `checked_in_at IS NOT NULL` without also filtering by card status, which could be fragile if cards are recycled.

### Changes

**1. `src/components/admin/VolunteerTrackingSection.tsx`**
- Add `.in('status', ['checked_in', 'checked_out'])` filter to the volunteer cards query (line 68-82) so that attended count is explicitly based on status, not just `checked_in_at`
- This makes it resilient to card recycling where `checked_in_at` might persist

**2. `src/hooks/useVolunteerDetails.ts`**
- The attended logic (line 95-101) already correctly checks `status === 'checked_in' || status === 'checked_out'` — no change needed there
- Add an additional stat: volunteers with QR cards generated (any status) vs those who only signed up, so the UI can distinguish "signed up only" from "attended"

**3. `src/components/admin/VolunteerDetailsSection.tsx`**
- Update the "Total Registered" card subtitle to clarify it includes sign-ups
- Optionally add a "QR Cards Generated" sub-stat showing how many of the registered volunteers actually received QR cards

### Summary
The main fix is adding explicit status filtering in `VolunteerTrackingSection.tsx` and making the data labels clearer so inactive sign-ups are visually separated from actual attendees.

