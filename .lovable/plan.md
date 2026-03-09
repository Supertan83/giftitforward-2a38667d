

# Add Beneficiary Sync to "Send to Surpluss" Button

## Problem
The "Send to Surpluss" button in Marketplace Reports only syncs volunteers and demographics. It does not send beneficiary data from `pending_beneficiaries` for the selected marketplace.

## Changes

### 1. Update `useSurplussVolunteerBeneficiarySync.ts` hook
- After the volunteer sync completes, also call `sync-surpluss-beneficiaries` with the same `marketplace_id` and `environment`
- Combine results from both calls into a unified response
- Update the toast messages to include beneficiary counts (sent/skipped/failed)
- Update the `SyncResult` interface to include beneficiary fields

### 2. No edge function changes needed
Both edge functions already exist and accept `marketplace_id` + `environment`. We just need the hook to call both sequentially.

