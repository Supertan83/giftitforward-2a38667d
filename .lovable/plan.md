

# Fix: Volunteer Registration Count Mismatch per Marketplace

## Problem
When viewing a marketplace report, "Total Registered" shows ~40 volunteers instead of the actual 70+ who signed up via the DH form. This is because the count is based solely on `volunteer_qr_cards.marketplace_id` and `volunteer_attendance.marketplace_id`, which only get set when a volunteer is checked in or manually assigned. Volunteers who registered via the form have their marketplace stored in `events_list`/`events_json` on `pending_volunteers`, but that data is never used for the registration count.

## Root Cause
In `src/hooks/useMarketplaceAllocations.ts` (the `useMarketplaceReport` hook), `totalRegistered` is set to `volCardMap.size`, which only includes:
1. Volunteers with `volunteer_attendance` records for the marketplace
2. Volunteers with `volunteer_qr_cards.marketplace_id` matching the marketplace

It completely ignores the `events_list`/`events_json` registration data.

## Fix

### File: `src/hooks/useMarketplaceAllocations.ts`

In the `useMarketplaceReport` query function (around line 483-665):

1. **Fetch registered volunteers from `pending_volunteers`** — Query all approved volunteers with non-null `events_list`, then filter client-side using the marketplace name slug matching (same logic already used in `VolunteerTrackingSection.tsx` lines 57-65).

2. **Set `totalRegistered`** to the count of volunteers matched from `events_list`/`events_json`, instead of `volCardMap.size`. This reflects actual form registrations.

3. **Keep `totalAttended`** as-is (from attendance/QR card records), since that correctly tracks who actually showed up.

4. **Recalculate `dropoutRate`** using the new `totalRegistered` as the denominator.

This ensures the marketplace report shows the true registration count from the DH form while attendance remains based on actual check-in data. The `VolunteerTrackingSection` component already does this correctly — we're applying the same pattern to the report hook.

