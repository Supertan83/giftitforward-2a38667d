

## Reverse Marketplace Overview Order (Oldest First)

**Change**: In `src/hooks/useMarketplaceAllocations.ts`, line 674, change the sort order from `ascending: false` to `ascending: true` so the "All Marketplaces Overview" list shows the earliest marketplace first and the most recent last.

**Single line change:**
```
// Before
.order('event_date', { ascending: false });

// After
.order('event_date', { ascending: true });
```

This affects only the overview grid on the reports page. The marketplace selector dropdown is unaffected (it uses a separate query).

