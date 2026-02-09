

# Auto-Sync Surpluss Allocations and Distributions into GIF App

## Overview

Currently, the GIF app manages its own item allocations and distributions locally (via `item_types` and `marketplace_item_allocations` tables). The user wants Surpluss to be the single source of truth: when warehouse staff scan a QR code on a box (e.g., `https://platform.thesurpluss.com/material/889`), allocate items to a marketplace in the Surpluss system, and save -- those allocations and any subsequent distributions should **automatically appear** in the GIF app.

## How It Will Work

```text
Surpluss System (Source of Truth)
        |
        |  1. Staff scans QR on box -> allocates to marketplace
        |  2. Saves allocation in Surpluss
        |
        v
  Polling Edge Function (runs on-demand or scheduled)
        |
        |  Fetches allocations per marketplace event from Surpluss API:
        |    GET /api/common/marketplace-events/:id/allocations
        |
        v
  GIF App Database
        |
        |  Upserts into:
        |    - item_types (material metadata)
        |    - marketplace_item_allocations (allocated + distributed qty)
        |
        v
  GIF Admin Dashboard (auto-reflects synced data)
```

## Implementation Steps

### 1. New Edge Function: `sync-surpluss-event-allocations`

A new backend function that:
- Accepts a GIF marketplace ID (which has an `external_id` linking to Surpluss)
- Calls `GET /api/common/marketplace-events/:external_id/allocations` to fetch all allocations for that event from Surpluss
- For each allocation:
  - Upserts the material into `item_types` (using `external_material_id` as key)
  - Upserts into `marketplace_item_allocations` matching the marketplace + item, setting `allocated_quantity` and `distributed_quantity` from Surpluss data (`amount` and `distributed_amount`)
- Logs the sync in `surpluss_api_audit_log`

### 2. "Sync from Surpluss" Button in Allocation Management

Add a prominent sync button to the existing **Allocation Management** view that:
- For the currently selected marketplace, triggers the new edge function
- Shows a loading state and reports how many allocations were synced
- Automatically refreshes the allocation table after sync

### 3. "Auto-Sync All" in Surpluss Sync Panel

Add a "Sync Allocations" action to the existing **Surpluss Sync Panel** that:
- Iterates over all marketplace events that have an `external_id`
- Calls the sync function for each one
- Provides a summary of total allocations synced across all events

### 4. Update Edge Function Config

Add the new function to `supabase/config.toml` with `verify_jwt = false`.

## Technical Details

### Edge Function Logic (sync-surpluss-event-allocations)

```text
Input: { marketplace_id (GIF UUID), environment }

1. Look up marketplace_events.external_id for the given marketplace_id
2. GET /api/common/marketplace-events/{external_id}/allocations
3. For each allocation:
   a. Find/create item_types row by external_material_id = allocation.donation_metadata.id
   b. Upsert marketplace_item_allocations:
      - marketplace_id = input marketplace_id
      - item_type_id = matched item_type
      - allocated_quantity = allocation.amount
      - distributed_quantity = allocation.distributed_amount || 0
4. Return summary of synced items
```

### Data Mapping

| Surpluss Field | GIF Table.Column |
|---|---|
| `allocation.donation_metadata.id` | `item_types.external_material_id` |
| `allocation.donation_metadata.title` | `item_types.name` |
| `allocation.amount` | `marketplace_item_allocations.allocated_quantity` |
| `allocation.distributed_amount` | `marketplace_item_allocations.distributed_quantity` |
| Marketplace event external ID | `marketplace_events.external_id` |

### Files to Create/Modify

- **Create**: `supabase/functions/sync-surpluss-event-allocations/index.ts` -- new edge function
- **Modify**: `supabase/config.toml` -- add function config
- **Modify**: `src/components/admin/AllocationManagement.tsx` -- add "Sync from Surpluss" button per marketplace
- **Modify**: `src/components/admin/SurplussSyncPanel.tsx` -- add "Sync All Allocations" action
- **Modify**: `supabase/functions/surpluss-allocations-api/index.ts` -- add auto-sync to GIF after successful allocate/batch_allocate actions (so when admins allocate via the Surpluss Allocation Control panel, GIF is updated immediately)

### Auto-Sync on Write

When allocations are created through the existing **Surpluss Allocation Control** panel (`surpluss-allocations-api` edge function), the function will be enhanced to automatically upsert into `marketplace_item_allocations` after a successful Surpluss API response. This means any allocation made from the GIF app to Surpluss will immediately reflect in the GIF allocation tables too.

