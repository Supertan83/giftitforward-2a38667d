

## Fix: Beneficiary Count Dropping to Zero After Checkout

### Problem
When beneficiaries are checked out, the marketplace report shows 0 beneficiaries. This happens because the query in `useMarketplaceReport` only fetches cards with status `active` or `inactive` -- it excludes `checked_out` cards entirely.

### Root Cause
In `src/hooks/useMarketplaceAllocations.ts`, line 294:
```
.in('status', ['active', 'inactive'])
```
This filter means checked-out beneficiaries are not counted in the report.

### Fix

**File: `src/hooks/useMarketplaceAllocations.ts`**

1. In `useMarketplaceReport` (line ~290-294): Change the `qr_cards` query to include ALL statuses that represent real beneficiaries -- `active`, `checked_out`, and `inactive`. The simplest fix is to remove the status filter entirely so all cards assigned to the marketplace are counted (matching what `useAllMarketplaceReports` already does).

2. This single-line change ensures:
   - Beneficiaries are counted when checked in (active)
   - Beneficiaries remain counted after checkout (checked_out)
   - The count stays consistent with the "All Marketplaces Overview" which already counts all cards

### Technical Detail
- Remove `.in('status', ['active', 'inactive'])` from line 294 in `useMarketplaceReport`
- This aligns the single-marketplace report with the all-marketplaces overview (which already counts all cards without filtering)

