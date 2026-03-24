

# Fix: Reverse Sync Deletion to Surpluss Platform

## Problem
When an item allocation is deleted from a marketplace in the GIF app, the deletion is not synced back to the Surpluss platform. The item remains visible on Surpluss.

There are **two places** where allocations get deleted:

1. **AllocationManagement.tsx** (`handleDelete`) — already has reverse sync using `batch_update` with `amount: 0`, but this may not be working correctly
2. **MarketplaceManualDataEditor.tsx** (`handleSave` → deletes via `deletedIds`) — has **no reverse sync at all**

## Root Cause
- The `MarketplaceManualDataEditor` deletes allocations from the local database but never calls the Surpluss API
- The `AllocationManagement` reverse sync uses `batch_update` which sets amount to 0 — this should work per the memory note about material-level operations, but we need to ensure the marketplace `external_id` and item `external_material_id` are available

## Fix

### 1. Add reverse sync to MarketplaceManualDataEditor.tsx
When deleting allocations in `handleSave`, look up each deleted allocation's `item_type_id` → `external_material_id` and the marketplace's `external_id`, then call the `surpluss-allocations-api` edge function with `batch_update` action setting `amount: 0` for each deleted material.

### 2. Ensure AllocationManagement.tsx reverse sync is robust
The existing logic looks correct. We'll verify it has proper error handling and doesn't block the UI on sync failure.

### Files to modify
- **`src/components/admin/MarketplaceManualDataEditor.tsx`**: Add reverse sync calls when deleting allocations (in the `handleSave` function, after deleting each allocation from GIF, call `surpluss-allocations-api` with `batch_update` / `amount: 0`)
- **`src/components/admin/AllocationManagement.tsx`**: Minor review — existing logic should work, no changes expected

### Technical approach
For each deleted allocation in `MarketplaceManualDataEditor`:
1. Before deleting, fetch the allocation's `item_type_id` from the local `editableRows` or query it
2. Look up the `external_material_id` from `item_types` 
3. Look up the marketplace's `external_id` from `marketplace_events`
4. Call `surpluss-allocations-api` with `{ action: 'batch_update', marketplace_event_id, materials: [{ material_id, amount: 0 }], environment: 'production' }`
5. Only the specific item is set to 0 — other allocations remain untouched

