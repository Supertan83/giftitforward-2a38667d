

## Bulk Reconcile All Materials — Remaining Count Fix

### Problem
The `reconcile_donation_remaining` endpoint only accepts a single `material_id`. When drift occurs across many materials, each must be fixed individually.

### Solution
Add a **bulk reconcile** action that iterates over all `item_types` with an `external_material_id` and calls the Tractor reconcile endpoint for each, collecting results. Expose this in the admin UI alongside the existing "Run Allocation Audit" button.

### Implementation

**1. New edge function action in `surpluss-allocations-api`**

Add a `bulk_reconcile_remaining` action:
- Queries all `item_types` where `external_material_id IS NOT NULL` from the database
- For each material, calls the Tractor `POST /donation-metadata/{id}/reconcile-remaining` endpoint
- Supports `dry_run` (default true)
- Returns a summary: how many materials were checked, how many had drift, details of corrections

**2. New client utility in `src/lib/surplussReconcileRemaining.ts`**

Add a `surplussBulkReconcileDonationRemaining` function that invokes the new action and returns typed results.

**3. UI button in `MaterialBreakdownLookup.tsx`**

Add a "Bulk Reconcile Remaining" button next to the existing "Run Allocation Audit" button. It will:
- Run dry_run first, show a summary of discrepancies found
- Allow applying the fix with a confirmation dialog
- Display results in a table showing material ID, title, old remaining, new remaining

### Technical Details

The edge function will:
```
case "bulk_reconcile_remaining": {
  // 1. Fetch all item_types with external_material_id from DB
  // 2. For each, POST to /donation-metadata/{material_id}/reconcile-remaining
  // 3. Collect results: { material_id, title, before, after, changed }
  // 4. Return summary + details
}
```

Rate limiting: add a small delay (200ms) between API calls to avoid overwhelming the Tractor API. Log the bulk operation to `surpluss_api_audit_log`.

