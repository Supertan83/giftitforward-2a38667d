

# Fix: Beneficiary Sync Reads From Empty Table

## Problem
The `sync-surpluss-beneficiaries` edge function queries the `pending_beneficiaries` table, which was just created and is empty. Your actual beneficiary data lives in `qr_cards` (active) and `archived_card_data` (checked out) tables — these are what the Marketplace Reports already use for demographics.

## Solution
Update the `sync-surpluss-beneficiaries` edge function to read beneficiary data from `qr_cards` and `archived_card_data` instead of `pending_beneficiaries`. This matches how Marketplace Reports already source their data.

## Changes

### 1. Update `supabase/functions/sync-surpluss-beneficiaries/index.ts`
- Replace the query to `pending_beneficiaries` with two queries:
  - `qr_cards` filtered by `marketplace_id` (active beneficiaries)
  - `archived_card_data` filtered by `marketplace_id` (checked-out beneficiaries)
- Combine both sets into a single beneficiary list
- The rest of the logic (payload building, API calls, deduplication, audit logging) stays the same since both tables have the same fields used by the function: `unique_id`, `gender`, `nationality`, `marital_status`, `children_count`, `marketplace_id`

### 2. No frontend changes needed
The hook already calls the edge function correctly with the marketplace ID.

