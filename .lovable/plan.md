

# Fix: Inventory Stock Mismatch — Wrong Quantity Field Used

## Problem

The `sync-surpluss-allocations` edge function sets `total_stock` from the wrong Surpluss API field:

```typescript
// Line 319 — current (WRONG)
const totalQty = donation.quantity ?? donation.item_count ?? 0;
```

`donation.quantity` is the **remaining unallocated quantity on Surpluss** (or a KG-based figure), NOT the total donated piece count. `donation.item_count` is the actual piece count.

**Evidence from database:**

| Material | `quantity` (wrong) | `item_count` (correct) | Current `total_stock` | Expected |
|---|---|---|---|---|
| #907 King Duvet | 429 | 208 | 429 | 208 |
| #935 Men's Clothes | 1168 | 4088 | 1168 | 4088 |
| #918 Kids Boys Perfume | 370 | 2000 | 730 (locked) | 2000 |
| #775 Kids Swimwear | 88 | 818 | 730 (locked) | 818 or 175* |

Additionally, Materials #907 and #935 have no allocations in GIF despite being allocated on Surpluss — this means the event-allocation sync hasn't picked them up (marketplace not linked or allocation not yet synced).

## Fix (2 parts)

### 1. Fix quantity priority in `sync-surpluss-allocations` edge function

Change line 319 from:
```typescript
const totalQty = donation.quantity ?? donation.item_count ?? 0;
```
to:
```typescript
const totalQty = donation.item_count ?? donation.quantity ?? 0;
```

This prioritizes `item_count` (pieces) over `quantity` (which represents remaining/KG).

### 2. Fix existing data for unlocked items

Run a one-time data correction to update `total_stock` for unlocked items using `item_count` from `external_items`:

```sql
UPDATE item_types it
SET total_stock = ei.item_count, updated_at = now()
FROM external_items ei
WHERE ei.external_id = it.external_material_id
  AND it.stock_locked = false
  AND ei.item_count > 0
  AND ei.item_count != it.total_stock;
```

### Note on Surpluss "Remaining" values

The "Remaining" numbers shown in the Surpluss platform screenshots (img1-4) are calculated on the Surpluss side (Total - all allocations across all events). This is a Surpluss platform calculation and cannot be fixed from GIF. The GIF system should show correct `total_stock` values and correct per-marketplace allocation breakdowns.

### Files to modify
- `supabase/functions/sync-surpluss-allocations/index.ts` (line 319: swap priority)
- One-time SQL data fix via migration tool

