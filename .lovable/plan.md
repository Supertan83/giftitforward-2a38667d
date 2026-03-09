

# Send Beneficiaries to Surpluss (alongside Volunteers)

## What changes

### 1. Edge function: `supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts`

**Add beneficiary sync step** after the volunteer sync (steps 5-6). For each marketplace being processed:

- Query `qr_cards` where `marketplace_id` matches, selecting `unique_id`, `gender`, `nationality`, `marital_status`, `children_count`, `total_items_collected`, `credit_balance`
- Build a payload per card similar to the volunteer payload format (since it goes to the same `/api/common/volunteers` endpoint), mapping:
  - `name` → unique_id (or "Beneficiary-{unique_id}")
  - `gender` → mapped to MALE/FEMALE
  - `nationality` → passed through
  - `type` → "beneficiary" (or similar flag to distinguish from volunteers)
  - `children_count`, `items_collected` as additional fields
- Deduplicate against `surpluss_api_audit_log` (action = `sync_beneficiary`) to avoid re-sending
- POST new beneficiaries, bulk-update previously synced ones
- Log each to `surpluss_api_audit_log` with action `sync_beneficiary`

**Keep demographics** (aggregated PUT to `/api/common/marketplace-events/{id}`) as-is.

### 2. Frontend: `src/components/admin/PendingVolunteers.tsx`

**Update the sync result dialog** to show beneficiary sync results:
- Add a new stats row for beneficiaries (total, sent, skipped, failed)
- Add a "Beneficiary Details" scrollable list similar to the volunteer details list
- Update the body payload to pass `include_beneficiaries: true` flag

### 3. Hook: `src/hooks/useSurplussVolunteerBeneficiarySync.ts`

- Update `SyncResult` interface to include `beneficiaries_sent`, `beneficiaries_failed`, `beneficiaries_total`, `beneficiary_details`
- Update toast messages to include beneficiary counts

## Technical details

- Beneficiaries come from the `qr_cards` table filtered by `marketplace_id`
- They are sent to `POST /api/common/volunteers` (same endpoint as volunteers) — the Surpluss API differentiates them by the data fields
- Deduplication uses `surpluss_api_audit_log` with a new action type `sync_beneficiary`
- Previously synced beneficiaries get bulk-updated via `POST /api/common/volunteers/bulk-update`
- The existing demographics PUT to `/api/common/marketplace-events/{id}` remains unchanged

