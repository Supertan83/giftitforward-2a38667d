

# Fix: Family Members Count Shows 0 — Wrong JSON Key

## Problem
The family member counting code looks for `evt['event-slug']` or `evt.event_slug` in `events_json`, but the actual field name in the data is just `event`. This means the slug never matches and `totalFamilyMembers` stays at 0.

**Evidence from database**: The `events_json` entries use `"event": "she-thrives-women-workers-marketplace---february-28---second-half"` — not `"event-slug"`.

For the "Feb 28 Second Half" marketplace, there are 55 primary volunteers with 19 adult + 20 children = 39 family members, so Total Registered should be 94 (or whatever the correct sum is).

## Fix

### File: `src/hooks/useMarketplaceAllocations.ts` (line 506)

Change the event slug extraction to also check the `event` key:

```typescript
// Before:
const eventSlug = (evt['event-slug'] || evt.event_slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// After:
const eventSlug = (evt['event-slug'] || evt.event_slug || evt['event'] || evt.event || '').toLowerCase().replace(/[^a-z0-9]/g, '');
```

This single-line fix will correctly match the event entries and sum `number-of-adults` + `number-of-children`, making the Family Members card and Total Registered show the correct numbers.

### Also fix: `src/hooks/useVolunteerDetails.ts` (line 62)

The same bug exists in the volunteer details hook — apply the same key fallback there too:

```typescript
const eventSlug = evt['event-slug'] || evt.event_slug || evt['event'] || evt.event || '';
```

### Files changed
1. `src/hooks/useMarketplaceAllocations.ts` — Add `evt['event']` fallback in family member counting
2. `src/hooks/useVolunteerDetails.ts` — Same fix for consistency

