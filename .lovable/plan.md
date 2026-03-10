

# Fix: Training After Event Card Showing Only 1 Volunteer

## Problem
The "Training After Event" card uses a strict `>` date comparison (`completedDate > eventDateStr`), which excludes volunteers who completed training **on the same day** as the marketplace event. Since most volunteers complete training on the event day itself (after the marketplace ends), they are not counted.

## Fix

### `src/hooks/useMarketplaceAllocations.ts` (line 792)
Change the date comparison from strict greater-than to greater-than-or-equal:

```typescript
// Before
if (completedDate > eventDateStr) {

// After
if (completedDate >= eventDateStr) {
```

This ensures volunteers who completed training on the event day (i.e., after the marketplace session that day) are included in the count. Single line change.

