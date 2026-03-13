

# Fix: Delete on GIF deletes ALL items on Surpluss instead of just one

## Root Cause

The `surpluss_allocation_id` stored on GIF allocations is the **Surpluss allocation container ID** — not a per-material identifier. One Surpluss allocation (e.g. ID `1`) contains 37+ materials. When GIF calls `DELETE /api/common/donation-allocations/1` to remove a single item, the Surpluss API deletes the **entire allocation container** and all its materials.

Example: `surpluss_allocation_id = 1` is shared by 37 items in "Young Dreamers Boys Community School Marketplace". Deleting any one of them wipes all 37 on Surpluss.

## Solution

Instead of calling `delete_allocation` (which removes the whole container), we need to **update the specific material's amount to 0** or use a material-level removal endpoint. The correct approach per the Surpluss API:

1. **Delete from GIF**: Use `batch_update` to set the specific material's amount to `0` on Surpluss (effectively removing it without destroying other materials in the same allocation)
2. **Edit on GIF**: Use `batch_update` with the specific material's new amount
3. **Return to warehouse on GIF**: Use `batch_update` to reduce the material's amount

For all reverse-sync operations, we need the **marketplace's `external_id`** (Surpluss event ID) and the **item's `external_material_id`** — not the `surpluss_allocation_id`.

## Changes

### 1. `src/components/admin/AllocationManagement.tsx`
Refactor all three reverse-sync calls (delete, edit, return) to:
- Look up the item's `external_material_id` from `itemTypes`
- Look up the marketplace's `external_id` from `marketplaces`
- Call `batch_update` with the specific material and new amount instead of `delete_allocation`/`update_allocation`

**Delete**: Call `batch_update` with `amount: 0` for that one material
**Edit**: Call `batch_update` with the new `amount` for that one material
**Return**: Call `batch_update` with the reduced `amount` for that one material

### 2. `supabase/functions/surpluss-allocations-api/index.ts`
No changes needed — `batch_update` action already exists and works correctly at the material level.

### 3. DB cleanup (optional, no migration needed)
The `surpluss_allocation_id` column can remain but is no longer used for reverse sync. The material-level approach using `external_material_id` + marketplace `external_id` is the correct path.

## Technical Detail

Current (broken):
```typescript
// Deletes ENTIRE allocation container on Surpluss
await invoke('surpluss-allocations-api', {
  body: { action: 'delete_allocation', allocation_id: alloc.surplussAllocationId }
});
```

Fixed:
```typescript
// Updates only the specific material to 0 on Surpluss
const itemType = itemTypes.find(i => i.id === alloc.itemTypeId);
const marketplace = marketplaces.find(m => m.id === selectedMarketplaceId);
if (itemType?.external_material_id && marketplace?.external_id) {
  await invoke('surpluss-allocations-api', {
    body: {
      action: 'batch_update',
      marketplace_event_id: marketplace.external_id,
      materials: [{ material_id: itemType.external_material_id, amount: 0 }],
      environment: 'production'
    }
  });
}
```

