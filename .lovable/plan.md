

## Add Auto-Sync for Volunteers & Beneficiaries

### Problem
Currently only allocation sync runs on a schedule (via `pg_cron`). Volunteer and beneficiary syncs are manual-only.

### Solution

**1. Update `update-sync-schedule` edge function** to create two additional cron jobs alongside the existing allocation sync:

- `sync-surpluss-volunteers` → calls `sync-surpluss-volunteer-beneficiary` with `{ "environment": "production" }` (no `marketplace_id` = processes all)
- `sync-surpluss-beneficiaries-auto` → calls `sync-surpluss-beneficiaries` with `{ "environment": "production" }` — but this function requires marketplace IDs, so the cron body will first need to be handled

**However**, `sync-surpluss-beneficiaries` requires explicit `marketplace_id` or `marketplace_ids`. Two options:

**Option A (Recommended):** Add "ALL" marketplace support to `sync-surpluss-beneficiaries` — when no `marketplace_id` is provided, fetch all marketplace_events with an `external_id` and process them all. This mirrors how `sync-surpluss-volunteer-beneficiary` already works.

**Option B:** Create a wrapper edge function. More complexity, less ideal.

### Changes

**File 1: `supabase/functions/sync-surpluss-beneficiaries/index.ts`**
- When `targetMarketplaceIds` is empty (no marketplace_id/marketplace_ids provided), query all `marketplace_events` that have an `external_id` and use all their IDs
- This enables calling it without parameters for auto-sync

**File 2: `supabase/functions/update-sync-schedule/index.ts`**
- Expand the unschedule query to also find jobs named `sync-surpluss-volunteers` or `sync-surpluss-beneficiaries-auto`, or whose command contains these function names
- When scheduling (interval > 0), create 3 cron jobs:
  1. `sync-surpluss-allocations` (existing) — allocation sync
  2. `sync-surpluss-volunteers-auto` — volunteer+demographics sync
  3. `sync-surpluss-beneficiaries-auto` — beneficiary sync
- All three use the same interval
- When disabling (interval = 0), unschedule all three

**File 3: `src/components/admin/SurplussSyncMonitor.tsx`**
- Update the Auto-Sync Status section to indicate that all three sync types (Allocations, Volunteers, Beneficiaries) are included in the scheduled sync
- Minor label change: "Scheduled Auto-Sync" description updated to mention all sync types

### Cron Job Details

```text
Job 1 (existing): sync-surpluss-allocations
  → POST /functions/v1/sync-surpluss-event-allocations
  → body: {"marketplace_id": "ALL", "environment": "production"}

Job 2 (new): sync-surpluss-volunteers-auto  
  → POST /functions/v1/sync-surpluss-volunteer-beneficiary
  → body: {"environment": "production"}
  (no marketplace_id = processes all marketplaces)

Job 3 (new): sync-surpluss-beneficiaries-auto
  → POST /functions/v1/sync-surpluss-beneficiaries
  → body: {"environment": "production"}
  (no marketplace_id = processes all marketplaces, after fix)
```

All jobs use the same schedule interval and are managed together.

