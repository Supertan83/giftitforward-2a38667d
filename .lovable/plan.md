

## Fix Export Volunteer Report Marketplace Filtering

### Root Cause
The export function uses a **different matching algorithm** than the main volunteer list filter, causing it to miss volunteers.

**Main filter (works):** Converts each slug via `formatEventName()` → normalizes → compares against the selected event name from the dropdown (which is also derived from `formatEventName()`). Both sides go through the same transformation, so they always match.

**Export filter (broken):** Compares against `marketplace_events.name` (e.g., `"Taxi Drivers Marketplace - Morning Event Day 2"`), using two strategies that both fail:

1. **Slug comparison**: Marketplace name → `taxi-drivers-marketplace---morning-event-day-2` (single dashes around "day"), but actual slug is `taxi-drivers-marketplace---morning-event---day-2` (triple dashes before "day"). Mismatch.

2. **formatEventName comparison**: `formatEventName()` converts triple-dashes to spaces (producing `Taxi Drivers Marketplace   Morning Event   Day 2`), but the marketplace name has ` - ` separators. After `.replace(/\s+/g, ' ')` normalization, the formatted slug becomes `taxi drivers marketplace morning event day 2`, while the marketplace name becomes `taxi drivers marketplace - morning event day 2`. The dash character causes a mismatch.

### Fix (1 file)
**`src/components/admin/PendingVolunteers.tsx`** — Replace the export's marketplace matching logic (lines ~1116-1131) to use the **same approach** as the main filter: normalize both sides by stripping all non-alphanumeric characters before comparing.

```typescript
if (exportMarketplace !== 'all') {
  const selectedMkt = marketplaces.find(m => m.id === exportMarketplace);
  if (selectedMkt) {
    const mktNormalized = selectedMkt.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    data = data.filter(v => {
      if (!v.events_list) return false;
      return v.events_list.split(',').some((e: string) => {
        const formatted = formatEventName(e.trim());
        const normalizedKey = formatted.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedKey === mktNormalized;
      });
    });
  }
}
```

This strips all dashes, spaces, and special characters from both strings before comparing, making `taxidriversmarketplacemorningeventday2` match on both sides.

### Affected Marketplaces
This fix resolves the issue for all marketplace names that contain ` - ` separators, including the newly renamed April events (all 10 upcoming events use this format).

