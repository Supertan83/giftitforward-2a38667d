

# Fix: Volunteer List Only Showing Card-Based Volunteers

## Problem
The "Total Registered" count correctly shows 55 (from form registrations), but the **Volunteer List** and **Category Breakdown** table only show 1 volunteer. This is because the list is built exclusively from `volCardMap` (attendance records + assigned QR cards). The 54 volunteers who registered via the DH form but have no QR card assigned to this marketplace are counted in the total but missing from the list.

## Root Cause
In `useMarketplaceAllocations.ts` (lines 585-641), the `volunteerList` array and `volCategoryMap` are populated by iterating over `volCardMap`, which only contains volunteers with:
1. `volunteer_attendance` records for this marketplace, OR
2. `volunteer_qr_cards` assigned to this marketplace

The `formRegisteredVolunteers` array (line 492-497) is used for the count but never merged into the list.

## Fix

### File: `src/hooks/useMarketplaceAllocations.ts`

After building `volunteerList` from `volCardMap` (around line 641), add a second pass over `formRegisteredVolunteers` to include any volunteers not already in the list:

1. Collect all `volunteer_id`s already in `volCardMap` into a Set
2. Loop through `formRegisteredVolunteers` — for each volunteer whose ID is NOT in the Set:
   - Add them to `volunteerList` with status `'registered'`, 0 hours, and their category/company/gender
   - Add them to `volCategoryMap` for the category breakdown
3. This ensures the list shows all 55 registered volunteers — the 1 with a QR card plus the 54 form-only registrations

This is a single block of ~25 lines inserted after the existing `volCardMap` iteration loop.

