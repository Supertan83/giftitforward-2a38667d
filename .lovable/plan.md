

# Add Family Members Card & Fix Total Registered in Marketplace Reports

## Problem
The Marketplace Reports volunteer section shows 4 cards: Total Registered, Total Attended, Total Hours, Drop-out Rate. The user wants:
1. A **Family Members** card added (like in the Statistics Dashboard's Volunteer Details section)
2. **Total Registered** to show volunteers + family members combined

## Current State
- `effectiveRegistered` already includes family members in the count (line 592: `totalRegisteredFromForm + totalFamilyMembers`)
- But `totalFamilyMembers` is not exposed separately in the report object — it's baked into `totalRegistered`
- The UI shows 4 cards in a 2x2 / 4-col grid with no family member card

## Changes

### 1. `src/hooks/useMarketplaceAllocations.ts`
- Add `familyMembers: number` to the `volunteers` type definition (line ~128)
- Expose `totalFamilyMembers` in the returned report object (line ~736):
  ```
  familyMembers: totalFamilyMembers,
  ```

### 2. `src/components/admin/MarketplaceReports.tsx` (lines 369-390)
- Change grid from `grid-cols-2 md:grid-cols-4` to `grid-cols-2 md:grid-cols-5`
- Add a **Family Members** card (violet themed, matching the Statistics Dashboard style) between Total Attended and Total Hours
- Update the "Total Registered" subtitle to say "Volunteers + Family" instead of "Volunteers"
- The Drop-out Rate subtitle should use `totalRegistered - familyMembers` for the dropout volunteer count to remain accurate

