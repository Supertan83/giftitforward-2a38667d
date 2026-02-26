

## Fix: Show +/- Quantity Buttons in Marketplace Zone

### Problem
The quantity selector (+/- buttons) is wrapped in a condition:
```
if (maxItemsPerScan > 1) { show buttons }
```
All marketplaces in the database have `max_items_per_scan = 1`, so the buttons are always hidden.

### Solution (Two Parts)

**1. Change the UI condition** so the +/- buttons always show, capped by the beneficiary credit limit instead of `max_items_per_scan`.

- File: `src/components/zones/MarketplaceZone.tsx`
- Remove the `{maxItemsPerScan > 1 && (...)}` wrapper so the quantity selector always renders
- Cap the maximum quantity at `creditLimit` (e.g., 15 or 20) instead of `maxItemsPerScan`
- Keep the quick-select presets (1, 3, 5, 10) filtered by the credit limit
- The "Max N items per scan" badge updates to reflect the credit limit

**2. No database changes needed** -- the `max_items_per_scan` column can stay as-is for future use if you ever want a station-level cap. The UI will just always show the selector now.

### Result
Volunteers will see the large +/- buttons and quick presets (1, 3, 5, 10) on every marketplace, matching what was built yesterday. Scanning deducts the selected quantity from the beneficiary's credits.
