

# Fix Export: Remove Date Range Filter When Marketplace Is Selected

## The Problem

The export filters volunteers by their **registration date** (`created_at`), but users expect it to return everyone registered for a selected marketplace event. This causes most volunteers to be missing from exports.

## The Fix

**File: `src/components/admin/PendingVolunteers.tsx` (export handler, ~lines 950-956)**

When a specific marketplace is selected in the export dialog, skip the `created_at` date range filter entirely. The marketplace selection alone is sufficient to scope the results.

When "All" marketplaces is selected, keep the date range filter as-is.

### Change

```text
Current:  Always apply .gte('created_at', startDate) and .lte('created_at', endDate)
Fixed:    Only apply those filters when exportMarketplace === 'all'
```

### One file, ~4 lines changed

In the `handleExportReport` function (~line 950), wrap the `.gte` and `.lte` calls in a condition:

```
if (exportMarketplace === 'all') {
  query = query.gte('created_at', startDateStr).lte('created_at', endDateStr);
}
```

No other changes needed.
