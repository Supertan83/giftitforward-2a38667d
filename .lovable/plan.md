

# Two-Way Sync: Gift App ↔ Tractor (Surpluss) Allocations

## Problem
Currently, changes flow one direction only — Tractor → Gift App via periodic sync. When items are deleted, updated, or returned in either system, the other system doesn't reflect the change.

## Current Architecture
- **Tractor → GIF**: `SurplussAllocationControl.tsx` calls `surpluss-allocations-api` edge function which proxies to Surpluss API. The `autoSyncToGif` only handles `allocate`/`batch_allocate` — not delete, update, or return.
- **GIF → Tractor**: `AllocationManagement.tsx` calls `useMarketplaceAllocations` hooks which only modify local DB. No Surpluss API calls.

## Solution

### Change 1: Tractor → GIF sync (edge function)
Expand `autoSyncToGif` in `surpluss-allocations-api/index.ts` to handle:
- **`delete_allocation`**: Find the GIF allocation by matching the Surpluss allocation ID (via `surpluss_allocation_sync` table or by material+marketplace), then delete it from `marketplace_item_allocations`
- **`update_allocation`**: Find and update `allocated_quantity` in the matching GIF allocation
- **`return_remaining`**: Find and delete or zero-out the matching GIF allocation
- **`batch_update`**: Update multiple allocations

This requires a lookup mechanism. The `surpluss_allocation_sync` table exists but maps Surpluss allocation IDs. We'll enhance `autoSyncToGif` to also store this mapping on allocate, then use it on delete/update/return.

### Change 2: GIF → Tractor sync (UI + hook)
When users delete/update/return allocations in the Gift App's Allocation Management:
- Look up the item's `external_material_id` and the marketplace's `external_id`
- Call `surpluss-allocations-api` with the appropriate action (`update_allocation`, `delete_allocation`, `return_remaining`)
- This keeps Tractor in sync

Add a new helper in `AllocationManagement.tsx` that calls the Surpluss API proxy after each local operation succeeds.

### Change 3: Track Surpluss allocation IDs
When syncing from Tractor (`sync-surpluss-event-allocations`), store the Surpluss allocation ID alongside the GIF allocation so we can reference it for updates/deletes back to Tractor.

Add a `surpluss_allocation_id` column to `marketplace_item_allocations` table to enable reverse lookups.

## Files to modify
- **`supabase/functions/surpluss-allocations-api/index.ts`** — expand `autoSyncToGif` for delete/update/return actions
- **`supabase/functions/sync-surpluss-event-allocations/index.ts`** — store Surpluss allocation ID during sync
- **`src/components/admin/AllocationManagement.tsx`** — add reverse sync calls after delete/update/return operations
- **`src/hooks/useMarketplaceAllocations.ts`** — optional: add Surpluss sync helper
- **DB migration** — add `surpluss_allocation_id` column to `marketplace_item_allocations`

## Technical Details

### DB Migration
```sql
ALTER TABLE marketplace_item_allocations 
ADD COLUMN surpluss_allocation_id bigint;
```

### autoSyncToGif expansion (edge function)
```typescript
// After delete_allocation succeeds on Surpluss API:
if (action === 'delete_allocation' && payload.allocation_id) {
  // Find GIF allocation by surpluss_allocation_id
  const { data: gifAlloc } = await supabase
    .from('marketplace_item_allocations')
    .select('id')
    .eq('surpluss_allocation_id', payload.allocation_id)
    .maybeSingle();
  if (gifAlloc) {
    await supabase.from('marketplace_item_allocations').delete().eq('id', gifAlloc.id);
  }
}
```

### GIF → Tractor reverse sync
```typescript
// After local delete succeeds in AllocationManagement:
const alloc = allocations.find(a => a.id === allocationId);
if (alloc?.surplussAllocationId) {
  supabase.functions.invoke('surpluss-allocations-api', {
    body: { action: 'delete_allocation', allocation_id: alloc.surplussAllocationId, environment: 'production' }
  });
}
```

