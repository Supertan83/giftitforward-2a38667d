

# Fix: Volunteer Details showing global counts instead of per-marketplace

## Problem
The "Volunteer Details" section in the Statistics Dashboard shows **all** approved volunteers across every marketplace (114), instead of filtering to the selected marketplace (~70 for "Feb 28 AM"). The `useVolunteerDetails` hook has no marketplace awareness — it queries all approved volunteers globally.

## Root Cause
- `useVolunteerDetails` (line 41) queries `pending_volunteers` with only `.eq('status', 'approved')` — no marketplace filter.
- The `StatisticsDashboard` doesn't have a marketplace selector at all, so even if the hook accepted one, there's nothing to pass.
- Meanwhile, `VolunteerTrackingSection` (used in marketplace reports) already correctly filters by marketplace name using `events_list` slug matching.

## Fix

### 1. Add marketplace selector to `StatisticsDashboard.tsx`
Add a marketplace dropdown at the top of the Statistics Dashboard (same pattern as used in other admin views) so admins can filter all stats by a specific marketplace. Import `useMarketplaces` and add a `Select` component.

### 2. Update `useVolunteerDetails` hook to accept optional `marketplaceName`
- Accept an optional `marketplaceName` parameter
- When provided, filter volunteers by matching their `events_list` against the marketplace name slug (same logic as `VolunteerTrackingSection` lines 59-64)
- Also filter `volunteer_qr_cards` attendance by `marketplace_id` when a marketplace is selected
- Filter family member counts from `registration_events` by matching `event_slug`
- Include `marketplaceName` in the `queryKey` for proper cache invalidation

### 3. Pass marketplace context to `VolunteerDetailsSection`
- Accept optional `marketplaceId` and `marketplaceName` props
- Forward `marketplaceName` to `useVolunteerDetails`

### Files changed
1. **`src/hooks/useVolunteerDetails.ts`** — Add marketplace filtering using events_list slug matching
2. **`src/components/admin/VolunteerDetailsSection.tsx`** — Accept and forward marketplace props
3. **`src/components/admin/StatisticsDashboard.tsx`** — Add marketplace selector, pass selected marketplace to VolunteerDetailsSection

