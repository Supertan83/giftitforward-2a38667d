
## Fix: Duplicate Item Types and Allocations from Auto-Sync

### Root Cause
The `syncMaterial` function in `sync-surpluss-event-allocations` uses `.maybeSingle()` to look up an existing `item_type` by `external_material_id`. Once the first duplicate was accidentally created, `.maybeSingle()` started returning an error (it expects 0 or 1 rows), causing the code to treat it as "not found" and create yet another duplicate on every sync cycle (~1 minute). This snowballed into **581 duplicate item_type rows** for material 884 ("Kids Waterbottles") and **602 duplicate allocation rows**.

### Fix Plan

**1. Fix the edge function (prevent future duplicates)**

In `supabase/functions/sync-surpluss-event-allocations/index.ts`, update the `syncMaterial` function:

- Change the item_type lookup from `.maybeSingle()` to `.limit(1).maybeSingle()` so it returns the first match even when duplicates exist
- Similarly, add `.limit(1)` to the allocation existence check

**2. Database cleanup (remove existing duplicates)**

Run a migration to:
- For `item_types`: Keep only the oldest row per `external_material_id`, delete all newer duplicates
- For `marketplace_item_allocations`: Keep only one allocation per `(marketplace_id, item_type_id)` combination, delete orphaned allocations pointing to deleted item_types
- Add a **unique constraint** on `item_types.external_material_id` (where not null) to prevent this from ever happening again

**3. Add unique constraint on allocations**

Add a unique constraint on `marketplace_item_allocations(marketplace_id, item_type_id)` to prevent duplicate allocation rows per marketplace/item combination.

### Impact
- Currently: 581 duplicate item_types, 602 duplicate allocations
- After fix: 1 item_type per material, 1 allocation per marketplace/item pair
- The 5-minute auto-sync will correctly update existing records instead of creating new ones

### Technical Details

Edge function change (line ~164-166 in `syncMaterial`):
```text
Before: .eq('external_material_id', materialId).maybeSingle()
After:  .eq('external_material_id', materialId).limit(1).maybeSingle()
```

Same fix for allocation lookup (line ~194-197):
```text
Before: .eq('marketplace_id', ...).eq('item_type_id', ...).maybeSingle()
After:  .eq('marketplace_id', ...).eq('item_type_id', ...).limit(1).maybeSingle()
```

Cleanup SQL:
```text
1. Identify the oldest item_type per external_material_id (keep it)
2. Update all marketplace_item_allocations to point to the kept item_type
3. Delete orphaned allocations
4. Delete duplicate item_types
5. Add UNIQUE constraint on item_types(external_material_id) WHERE external_material_id IS NOT NULL
6. Add UNIQUE constraint on marketplace_item_allocations(marketplace_id, item_type_id)
```
