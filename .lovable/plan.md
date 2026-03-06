

# Fix Volunteer Count Cards to Match Volunteer List

## Problem
The summary cards show `Total Registered: 106` (70 form volunteers + 36 family members), but the volunteer list only shows ~85 people. Family members are counted as a numeric total from `number-of-adults` and `number-of-children` fields but are NOT added as individual rows in the volunteer list. This creates a disconnect.

**Database reality for Feb 21 marketplace:**
- 70 form-registered volunteers (events_list match)
- 36 family members (number-of-adults + number-of-children sum)
- 43 QR cards (29 distinct volunteers) with attendance/assignment
- Volunteer list = 43 card entries + 42 form-only = 85 rows

## Fix

### File: `src/hooks/useMarketplaceAllocations.ts`

**1. Add family members as individual rows in the volunteer list** (lines 664-697 area)

After merging form-registered volunteers who don't have cards, also add their dependents from `events_json` as separate rows in the `volunteerList`. For each form-registered volunteer with dependents for this marketplace:
- Extract dependents using `extractUniqueDependents` (already exists)
- Add each dependent as a row with `name: "DependentName (Family)"`, `status: 'registered'`, `hoursWorked: 0`, `category` inherited from primary volunteer, `company` inherited

This ensures the volunteer list actually contains family member rows.

**2. Update `effectiveRegistered`** (line 593)

Change from `Math.max(totalRegisteredFromForm + totalFamilyMembers, totalVolunteers)` to simply use the actual `volunteerList.length` after all entries (cards + form-only + dependents) are added. Move the `effectiveRegistered` calculation to AFTER the list is built.

**3. Recalculate `totalFamilyMembers`** to count actual dependent rows added to the list (not the `number-of-adults`+`number-of-children` sum which can include the primary volunteer themselves in `total-attendees`).

### Summary of changes
- Family members become actual rows in the volunteer list (name resolved from `dependents` array in `events_json`)
- `totalRegistered` = `volunteerList.length`
- `familyMembers` = count of family rows in the list
- All 3 numbers (Total Registered, Family Members, list row count) will match

### Files changed
1. `src/hooks/useMarketplaceAllocations.ts` — Add dependent rows to volunteerList, derive card counts from list

