

# Fix: Total Registered should include family members

## Problem
The "Total Registered" count in Marketplace Reports only counts primary volunteers. The user wants it to include family members registered for that specific marketplace.

## Current logic
- `totalRegisteredFromForm` = count of `formRegisteredVolunteers` (primary volunteers only)
- `effectiveRegistered = Math.max(totalRegisteredFromForm, totalVolunteers)`
- Family member data exists in each volunteer's `events_json` array, with per-event `number-of-adults` and `number-of-children` fields

## Fix

### File: `src/hooks/useMarketplaceAllocations.ts`

After calculating `totalRegisteredFromForm` (line 498), add a family member count by iterating over `formRegisteredVolunteers` and summing `number-of-adults` + `number-of-children` from the matching event in each volunteer's `events_json`:

```typescript
let totalFamilyMembers = 0;
for (const fv of formRegisteredVolunteers) {
  if (fv.events_json && Array.isArray(fv.events_json)) {
    for (const evt of fv.events_json as any[]) {
      const eventSlug = (evt['event-slug'] || evt.event_slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (eventSlug === marketplaceNameSlug) {
        totalFamilyMembers += (evt['number-of-adults'] || evt.number_of_adults || 0);
        totalFamilyMembers += (evt['number-of-children'] || evt.number_of_children || 0);
      }
    }
  }
}
```

Then update `effectiveRegistered` (line 578) to include family members:

```typescript
const effectiveRegistered = Math.max(totalRegisteredFromForm + totalFamilyMembers, totalVolunteers);
```

This ensures the "Total Registered" stat reflects both primary volunteers and their registered family members for each specific marketplace.

### Files changed
1. **`src/hooks/useMarketplaceAllocations.ts`** -- Add family member counting from `events_json` per marketplace

