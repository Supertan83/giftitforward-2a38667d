

## Fix: Volunteer Dashboard Shows "No Marketplace" for Completed Events

### Root Cause

The volunteer dashboard filters marketplaces to only show `upcoming` or `active` status. When a volunteer is checked into a marketplace that later gets marked as `completed`, their card still references that marketplace ID -- but the UI can't find it in the filtered list, so it shows "No marketplace".

For example, volunteer `princesssweenavillaluz@gmail.com` is checked into "Lea's Marketplace" (Feb 2), which now has `status: completed`. The dashboard filters it out, resulting in "No marketplace" display.

### Fix

**File: `src/components/VolunteerInterface.tsx`**

Instead of only looking up the marketplace name from the filtered `availableMarketplaces` list, look it up from the **full** `marketplaces` list. The filtering should only apply to marketplace selection dropdowns (employee-facing), not to the volunteer's own display.

Changes:
1. Find `selectedMarketplace` from the full `marketplaces` array instead of `availableMarketplaces`
2. This ensures the volunteer sees "Lea's Marketplace" even after the event is marked completed

This is a one-line change on line 47:
- Before: `const selectedMarketplace = availableMarketplaces.find(m => m.id === selectedMarketplaceId);`
- After: `const selectedMarketplace = marketplaces.find(m => m.id === selectedMarketplaceId);`

### Why This Is Safe

- The `availableMarketplaces` filtered list is not used anywhere else in `VolunteerInterface.tsx` (no marketplace selector dropdown exists on the volunteer side)
- The volunteer only needs to **display** the marketplace name, not select one
- The employee-facing `VolunteerZone.tsx` already has its own separate filtering logic

