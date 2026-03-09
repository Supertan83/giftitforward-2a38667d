

# Fix: Send Beneficiaries Under Their Marketplace Event

## Problem
The beneficiary sync sends each beneficiary to `POST /api/common/volunteers` without including the Surpluss `event_id`. Surpluss has no way to know which marketplace/event each beneficiary belongs to, so they appear nowhere.

## Solution
Include the marketplace's `external_id` as `event_id` in each beneficiary payload sent to Surpluss. This links beneficiaries to their correct marketplace event on the Surpluss side.

## Changes

### 1. Edge Function: `supabase/functions/sync-surpluss-beneficiaries/index.ts`

- When fetching marketplace data (line 137-141), also select `external_id`
- Add `event_id: marketplace.external_id` to every beneficiary payload in `buildBeneficiaryPayload` (pass it as a parameter)
- Also add `event_id` to the bulk-update payloads for previously synced cards
- Skip marketplaces that have no `external_id` (log a warning)

### 2. No UI changes needed
The button already correctly passes `marketplace_id` / `marketplace_ids`. The fix is purely in the edge function payload.

