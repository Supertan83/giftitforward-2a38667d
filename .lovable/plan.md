

## Fix: Send Distribution Figures with "Send to Surpluss"

### Problem
The "Send to Surpluss" button currently only syncs **volunteers** and **beneficiaries**. It never sends **distribution data** (total items, distributed, remaining). The `reportMarketplaceDistribution` function exists in `useSurplussDistributionReporting.ts` but is not wired into the sync flow.

### Solution
Add distribution reporting as a third step in the `syncToSurpluss` flow, after volunteer and beneficiary syncs.

### Changes

**1. `src/hooks/useSurplussVolunteerBeneficiarySync.ts`**
- Import and call `reportMarketplaceDistribution` from `useSurplussDistributionReporting.ts` as a third sequential step after beneficiary sync
- Add distribution result fields to `SyncResult` interface (distribution_reported, distribution_error)
- Include distribution status in the toast summary
- Handle distribution failures gracefully (don't block the overall sync)

**2. `src/components/admin/MarketplaceReports.tsx`**
- Update the toast/UI to reflect that distribution data is also being sent
- No structural changes needed since the button already calls `syncToSurpluss`

### Data Flow After Fix
```text
"Send to Surpluss" click
  ├─ Step 1: sync-surpluss-volunteer-beneficiary (volunteers + demographics)
  ├─ Step 2: sync-surpluss-beneficiaries (beneficiary records)
  └─ Step 3: report-surpluss-distribution (allocation figures per material)
       └─ Uses manual counts when available, falls back to allocation table
```

### Technical Detail
The `reportMarketplaceDistribution` function already correctly:
- Groups materials by `surpluss_allocation_id`
- Prefers manual counts (`marketplace_manual_counts`) over system-tracked `distributed_quantity`
- Computes `allocated = distributed + remaining` from the correct source
- Sends via `report-surpluss-distribution` edge function to the Tractor API

The only missing piece is calling it from the sync flow.

