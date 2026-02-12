

# Fix: Sync All 296 Volunteers Directly from pending_volunteers Table

## Problem

The current edge function fetches volunteers through `volunteer_qr_cards` grouped by marketplace. Since most QR cards have no marketplace assigned, only ~12 volunteers get processed. The actual 296 volunteers live in the `pending_volunteers` table and should be sent directly.

## Solution

Rewrite the core sync logic in the edge function to query `pending_volunteers` directly instead of going through `volunteer_qr_cards`.

## Changes

### Edge Function (`supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts`)

**Replace the marketplace-loop approach with a single direct query:**

1. Fetch ALL records from `pending_volunteers` table directly (no marketplace filter)
2. For each volunteer, check deduplication against `surpluss_api_audit_log` (by email)
3. Send each volunteer to Surpluss API via POST `/api/common/volunteers`
4. Handle "already exists" responses as "skipped"
5. Keep the demographics update logic for marketplaces that have a matching Surpluss event (unchanged)

**New flow:**

```text
1. Fetch all previously synced emails from audit log (deduplication)
2. Fetch ALL volunteers from pending_volunteers table
3. For each volunteer:
   a. Skip if email already synced (deduplication)
   b. POST to Surpluss /api/common/volunteers
   c. If "already exists" response -> mark as skipped
   d. Log result in audit log
4. Report totals: sent, skipped, failed
5. (Optional) Still process demographics per marketplace if Surpluss event match exists
```

**Key details:**
- No longer depends on `volunteer_qr_cards` or `marketplace_id` for volunteer sending
- The `marketplace_id` / `marketplace_ids` parameters become optional and only used for demographics updates
- Volunteer payload includes: name, email, phone, source="API"
- Deduplication uses email from `surpluss_api_audit_log` where action='sync_volunteer' and success=true

### No UI Changes Needed

The existing sync results dialog in `PendingVolunteers.tsx` already handles the `volunteer_details` array with status badges, so all 296 volunteers will appear in the results automatically.

