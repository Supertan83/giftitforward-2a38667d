

# Fix: Family Member Counts Concatenating as Strings

## Problem
The `events_json` blob stores `number-of-adults` and `number-of-children` as **string values** (e.g., `"2"` not `2`). Using `+=` with these values concatenates them into a massive string that JavaScript then interprets as a huge number like `4.5e+92`.

## Fix
Wrap all family member values with `Number()` to coerce strings to integers before summing.

### File 1: `src/hooks/useMarketplaceAllocations.ts` (lines 508-509)

```typescript
// Before:
totalFamilyMembers += (evt['number-of-adults'] || evt.number_of_adults || 0);
totalFamilyMembers += (evt['number-of-children'] || evt.number_of_children || 0);

// After:
totalFamilyMembers += Number(evt['number-of-adults'] || evt.number_of_adults || 0);
totalFamilyMembers += Number(evt['number-of-children'] || evt.number_of_children || 0);
```

### File 2: `src/hooks/useVolunteerDetails.ts` (lines 63-64)

Apply the same `Number()` wrapping to the family member counting in the volunteer details hook.

