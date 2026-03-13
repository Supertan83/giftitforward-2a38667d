

# Two-Way Sync: Gift App ↔ Tractor (Surpluss) Allocations — IMPLEMENTED

## Changes Made

### 1. DB Migration
- Added `surpluss_allocation_id bigint` column to `marketplace_item_allocations` table

### 2. Edge Function: `surpluss-allocations-api/index.ts` (rewritten)
- Refactored `autoSyncToGif` to handle ALL write actions:
  - `allocate` / `batch_allocate`: Create/update GIF allocations (existing behavior)
  - `delete_allocation`: Find GIF allocation by `surpluss_allocation_id` and delete it
  - `update_allocation`: Find and update `allocated_quantity` in matching GIF allocation
  - `return_remaining`: Zero-out or delete the GIF allocation
  - `batch_update`: Update multiple GIF allocations
- Extracted helpers: `findGifMarketplace`, `findOrCreateItemType`, `upsertGifAllocation`

### 3. Edge Function: `sync-surpluss-event-allocations/index.ts`
- `syncMaterial` now accepts optional `surplussAllocationId` parameter
- Stores `surpluss_allocation_id` on insert/update of `marketplace_item_allocations`
- Extracts `alloc.id` from Surpluss API response as the allocation ID

### 4. Hook: `useMarketplaceAllocations.ts`
- Added `surplussAllocationId` to `MarketplaceAllocation` interface
- Maps `surpluss_allocation_id` from DB to the interface

### 5. UI: `AllocationManagement.tsx`
- **Delete**: After local delete, calls `surpluss-allocations-api` with `delete_allocation` if `surplussAllocationId` exists
- **Edit**: After saving edits, calls `update_allocation` on Surpluss
- **Return to warehouse**: After returning items, calls `return_remaining` or `update_allocation` on Surpluss
