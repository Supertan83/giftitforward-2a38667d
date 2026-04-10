

## Fix: Allocation Numbers Mismatch (36,662 vs 37,225)

### Root Cause

The Surpluss API returns duplicate material IDs within the same allocation container. For example, event 33 (Construction Morning) has:

| Material | Surpluss entries | Our DB | Correct total |
|---|---|---|---|
| #987 Blankets | 107 + 120 | 120 (last write wins) | 227 |
| #658 Pillows | 100 + 123 | 123 | 223 |
| #621 Napkins | 356 + 1700 | 1700 | 2056 |

The `allocate-donations-to-marketplace` edge function processes each material entry individually, and when it encounters a duplicate material_id, the `upsertAllocation` function **overwrites** the previous amount instead of **summing** them. This causes a 563-item shortfall (36,662 vs 37,225).

### Fix

**1. Code fix** — `allocate-donations-to-marketplace/index.ts`: Before calling `upsertAllocation`, aggregate all amounts per material_id per marketplace. Build a map of `materialId → {title, totalAmount, category, subcategory}` and sum duplicate entries, then upsert once per material with the correct total.

**2. Database fix** — Re-run the sync after deploying the code fix. Or manually correct the 3 affected allocations:

```sql
-- Blankets #987: 120 → 227
-- Pillows #658: 123 → 223  
-- Napkins #621: 1700 → 2056
UPDATE marketplace_item_allocations SET allocated_quantity = 227
WHERE item_type_id = (SELECT id FROM item_types WHERE external_material_id = 987)
  AND marketplace_id = '6ed111b0-f003-46e8-a719-d76cc1800431';

UPDATE marketplace_item_allocations SET allocated_quantity = 223
WHERE item_type_id = (SELECT id FROM item_types WHERE external_material_id = 658)
  AND marketplace_id = '6ed111b0-f003-46e8-a719-d76cc1800431';

UPDATE marketplace_item_allocations SET allocated_quantity = 2056
WHERE item_type_id = (SELECT id FROM item_types WHERE external_material_id = 621)
  AND marketplace_id = '6ed111b0-f003-46e8-a719-d76cc1800431';
```

After this fix, Construction Morning will show **37,225** — matching Surpluss exactly.

### Changes

| Action | Type |
|---|---|
| Aggregate duplicate material amounts before upserting in `allocate-donations-to-marketplace` | Code fix (edge function) |
| Correct 3 allocation quantities for Construction Morning | Database fix |

