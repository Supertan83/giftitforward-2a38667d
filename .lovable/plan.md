

# Direct API Delete Instead of Reverse Sync

## What Changes

Replace the `batch_update` (amount: 0) reverse sync approach with a direct `delete_allocation` API call to Surpluss when items are deleted from a marketplace. This applies to **two files**:

### 1. `src/components/admin/AllocationManagement.tsx` — `handleDelete` (line ~194)

**Current**: Calls `batch_update` with `amount: 0` using `external_material_id` and marketplace `external_id`.

**New**: Use the `delete_allocation` action with the allocation's `surpluss_allocation_id` (already available via `alloc.surplussAllocationId` from the hook). If the allocation has a `surplussAllocationId`, call:
```typescript
action: 'delete_allocation',
allocation_id: alloc.surplussAllocationId,
environment: 'production'
```
If no `surplussAllocationId` exists (locally-created allocation), skip the API call — nothing to delete on Surpluss.

### 2. `src/components/admin/MarketplaceManualDataEditor.tsx` — `handleSave` deletion block (lines ~148-193)

**Current**: Looks up `external_material_id` for deleted items and calls `batch_update` with `amount: 0`.

**New**: Before deleting from GIF, fetch `surpluss_allocation_id` from `marketplace_item_allocations` for each deleted ID. For each allocation that has a `surpluss_allocation_id`, call:
```typescript
action: 'delete_allocation',
allocation_id: surplussAllocationId,
environment: 'production'
```
This simplifies the code — no need to look up `external_material_id` or marketplace `external_id`. Just use the `surpluss_allocation_id` directly.

### Files to modify
- `src/components/admin/AllocationManagement.tsx`
- `src/components/admin/MarketplaceManualDataEditor.tsx`

No edge function changes needed — `delete_allocation` action already exists in `surpluss-allocations-api` and calls `DELETE /api/common/donation-allocations/{allocation_id}` on Surpluss.

