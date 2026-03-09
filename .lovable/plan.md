

# Create Dedicated Beneficiary Sync Edge Function

## Summary

Deploy the uploaded `beneficary_1.js` as a new standalone edge function `sync-surpluss-beneficiaries` that sends beneficiary data to Surpluss independently from the volunteer sync. The uploaded code queries a `pending_beneficiaries` table that does not exist in the current schema, so it will be adapted to use the existing `qr_cards` table instead.

## Changes

### 1. New Edge Function: `supabase/functions/sync-surpluss-beneficiaries/index.ts`

Based on the uploaded file, adapted to:
- Query `qr_cards` (filtered by `marketplace_id`) instead of non-existent `pending_beneficiaries`
- Use `buildBeneficiaryPayload` from the uploaded file (gender mapping, nationality, marital status, children count, items collected)
- POST to `/api/common/volunteers` with `type: "beneficiary"`
- Deduplication via `surpluss_api_audit_log` with action `sync_beneficiary`
- Skip previously synced cards
- Return detailed results (sent/failed/skipped counts + per-card details)

### 2. Config: `supabase/config.toml`

Add `[functions.sync-surpluss-beneficiaries]` with `verify_jwt = false`.

### 3. Frontend Hook: `src/hooks/useSurplussBeneficiarySync.ts`

New hook to invoke the dedicated function, similar to `useSurplussVolunteerBeneficiarySync` but calling `sync-surpluss-beneficiaries`.

### 4. UI: `src/components/admin/PendingVolunteers.tsx`

Add a separate "Send Beneficiaries to Surpluss" button that uses the new hook, with its own result dialog showing beneficiary sync stats.

### 5. Remove beneficiary logic from existing function

Remove the individual beneficiary card sync (lines 463-592) from `sync-surpluss-volunteer-beneficiary/index.ts` since it will now be handled by the dedicated function. Keep volunteer + demographics sync intact.

