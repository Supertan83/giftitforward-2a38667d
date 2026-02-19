

## Fix: Volunteer Dashboard Not Showing Marketplaces

### Root Cause

When an employee checks in a volunteer using the Volunteer Zone scanner, the marketplace selection is **optional** -- if the employee forgets to select a marketplace before scanning, the volunteer's QR card gets saved with `marketplace_id = null`. 

On the volunteer's own dashboard (`VolunteerInterface`), the marketplace name is pulled from this card field. Since it's null, the volunteer sees "No marketplace".

Currently, 3 out of 10 recently checked-in volunteer cards have no marketplace assigned.

### Fix

Two changes to prevent this:

1. **Block check-in without marketplace selection** -- In `VolunteerZone.tsx` (the employee-facing check-in screen), require the employee to select a marketplace before the "Scan to Check In" button becomes active. Show a warning if no marketplace is selected.

2. **Auto-select today's active marketplace** -- If there is exactly one marketplace with today's date or with `status = 'active'`, auto-select it so the employee doesn't have to manually pick it every time.

### Technical Changes

**File: `src/components/zones/VolunteerZone.tsx`**

- Add a `useEffect` that auto-selects a marketplace if one matches today's date or has `active` status
- Disable the "Scan to Check In" button when no marketplace is selected (check-out can proceed without one)
- Show a small inline warning below the scan button if marketplace is not selected during check-in mode

**No database or edge function changes needed.**

