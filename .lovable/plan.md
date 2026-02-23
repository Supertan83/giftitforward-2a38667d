

# Fix Duplicate Volunteer Names in Marketplace Reports

## Problem

The volunteer list in Marketplace Reports shows the **same name repeated** for family members. For example:
- "YOGESH ARORA" appears 3 times (primary card + 2 family cards F1, F2)
- "Arish Shrestha" appears 2 times (primary + 1 family card)
- "Aeimy Dissanayake" appears 2 times (primary + 1 family card)

Family QR cards (suffixed like `-F1KZ`, `-F299`) share the same `volunteer_id`, so they all resolve to the parent volunteer's name. The actual family member names are stored in the volunteer's `events_json` dependents array (e.g., "Romika Arora", "Fatima Faiz", "Deepesh Pacheri").

## Solution

Add family member name resolution to the marketplace report's volunteer list builder. This reuses the same positional matching logic already used in the Family Members tab and Pending Volunteers section:

1. Detect if a QR card is a family card by checking for the `-F{index}` suffix in `unique_id`
2. Extract the family index number (e.g., `-F1` = index 1, `-F2` = index 2)
3. Look up the corresponding dependent name from the volunteer's `events_json`
4. Display the resolved family member name with a visual indicator (e.g., suffix or label)

## Technical Changes

### File: `src/hooks/useMarketplaceAllocations.ts`

1. Add a helper function to resolve family member names from `events_json` (same logic as `FamilyMembersTab`):

```text
resolveFamilyName(cardUniqueId, eventsJson):
  - Check if unique_id contains "-F{digit}" pattern
  - Extract the family index
  - Flatten all dependents from events_json
  - Return the dependent at that index, or fallback to "Family Member {index}"
```

2. Update the volunteer data fetching to also include `events_json` from `pending_volunteers` in the select query

3. In the volunteer list building loop (where names are constructed), check if the card is a family card:
   - If it is a family card: resolve the name from dependents and append a "(Family)" label
   - If it is a primary card: keep the current name logic unchanged

### File: `src/components/admin/MarketplaceReports.tsx`

No structural changes needed. The volunteer list will automatically show resolved family names since the data comes from the hook. Optionally, add a visual badge/tag for family members to make them easily distinguishable.

## Example Result

Before:
```text
YOGESH ARORA    Corporate External    Al Gurg Group    Checked In
YOGESH ARORA    Corporate External    Al Gurg Group    Checked In
YOGESH ARORA    Corporate External    Al Gurg Group    Checked In
```

After:
```text
YOGESH ARORA           Corporate External    Al Gurg Group    Checked In
Romika Arora (Family)  Corporate External    Al Gurg Group    Checked In
Family Member 2        Corporate External    Al Gurg Group    Checked In
```

## What Does Not Change

- Volunteer counts (family members still count as individual volunteers)
- Hours tracking (each card tracks independently)
- Category breakdown logic
- Check-in/check-out flow
- Any database schema
