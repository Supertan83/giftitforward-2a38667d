
## What's happening

You're trying to reallocate items from yesterday afternoon (Taxi Drivers Afternoon, external_id `38`, **status: completed**) to today's morning (Day 2 Morning, external_id `39`, **status: active**).

The error is from the **Tractor/Surpluss API**, not our app. From edge logs:
```
PUT batch-allocation marketplace_event_id: 38, material_id: 782, amount: 1223
→ 404 "Allocation not found for marketplace event"
```

## Root cause

The Surpluss-side allocation for yesterday afternoon (event 38) **no longer exists on Tractor** — likely because:
1. Yesterday's event was already closed/reported on Surpluss after distribution, so the allocation record was finalized/removed there.
2. Our local DB still has the row but `surpluss_allocation_id` is **NULL** for both items (Napkins #621 = 3000, Storage Containers #782 = 1223), meaning we never had a confirmed link.
3. There is **also corrupt data**: Storage Containers shows `distributed_quantity = 12355` against `allocated_quantity = 1223` — that's clearly broken (more distributed than allocated).

So the reverse-sync push to Tractor for event 38 will keep failing — there's nothing on their side to update.

## Plan (data fix only, no code changes)

Two-step correction directly in the database for yesterday's Afternoon event allocations:

1. **Cap the corrupt distributed_quantity** on Storage Containers:
   - `distributed_quantity` 12355 → 1223 (cannot exceed allocated)
   - Log entry in `allocation_traceability_logs`

2. **Soft-delete** the two leftover Afternoon allocations (Napkins + Storage Containers for marketplace `a5a856a1...`) so they:
   - Stop triggering failed Tractor sync attempts
   - Free up the stock for reallocation to today's Morning Day 2

3. After cleanup, you can re-allocate freely from today's Morning event in the UI — that will create fresh allocation rows and push them to Tractor cleanly (event 39 is active and unallocated).

```sql
-- Fix corrupt distribution
UPDATE marketplace_item_allocations
SET distributed_quantity = 1223, updated_at = now()
WHERE id = '021085ae-dedf-448c-9731-6494bfe41701';

-- Soft-delete the two stuck Afternoon allocations
UPDATE marketplace_item_allocations
SET deleted_at = now()
WHERE id IN (
  '021085ae-dedf-448c-9731-6494bfe41701', -- Storage containers
  'eb0af2e6-78bc-4459-8842-6d7081976f19'  -- Napkins
);

-- Audit trail
INSERT INTO allocation_traceability_logs
  (item_type_id, marketplace_id, marketplace_name, action_type,
   quantity_before, quantity_after, description, performed_by_email)
VALUES
  ('239cfaf4-7d97-4e17-9f70-ac7c9c9bb1a1', 'a5a856a1-097b-42b0-a68f-a24c629f9e58',
   'Taxi Drivers Afternoon', 'cleanup_for_reallocation',
   1223, 0,
   'Soft-deleted stuck Storage Containers allocation (Surpluss returned 404). Distributed capped from 12355 to 1223. Frees stock for Day 2 Morning.',
   'system@manual-fix'),
  ('71c818a2-a200-4a38-a0ea-bd7e018db41a', 'a5a856a1-097b-42b0-a68f-a24c629f9e58',
   'Taxi Drivers Afternoon', 'cleanup_for_reallocation',
   3000, 0,
   'Soft-deleted stuck Napkins allocation (Surpluss returned 404). Frees stock for Day 2 Morning.',
   'system@manual-fix');
```

After this runs, retry the allocation to today's Morning event — it should sync to Tractor successfully.

**Note:** Yesterday's beneficiary counts (469/375) and reports stay untouched — this only cleans up the two unfinished allocation rows that never made it to Tractor.
