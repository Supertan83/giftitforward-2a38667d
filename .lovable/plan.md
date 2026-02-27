

## Fix Surpluss Allocation Sync to Use Correct API Endpoint

### Problem
The sync functions use the wrong API endpoints, pulling ALL global donations (~497k pieces) instead of event-specific allocations. This caused 720 incorrect allocation records (248k+ pieces per marketplace instead of the correct amounts).

### Root Cause
| Function | Current (wrong) endpoint | Correct endpoint |
|---|---|---|
| `sync-surpluss-event-allocations` | `GET /marketplace-events/:id/allocations` (returns empty) | `GET /donation-allocations?event_id=:id` |
| `allocate-donations-to-marketplace` | `GET /donations` (returns ALL global donations) | `GET /donation-allocations?event_id=:id` |

### Fix Plan (4 steps)

#### Step 1: Clear 720 incorrect allocation records
Delete all `marketplace_item_allocations` for both Feb 28 marketplaces (zero distributions, safe to delete):
- First Half (`ff0d8005...`, ext_id 11): 360 records, 248,854 pieces
- Second Half (`1e38fa11...`, ext_id 5): 360 records, 248,706 pieces

#### Step 2: Fix `sync-surpluss-event-allocations/index.ts`
In `syncSingleMarketplace()` (line 218), change the URL from:
```text
/api/common/marketplace-events/{ext_id}/allocations
```
to:
```text
/api/common/donation-allocations?event_id={ext_id}&limit=100
```
Add pagination support since this endpoint paginates (loop pages until all fetched).

The response format from the correct endpoint:
```text
{
  "data": [{
    "id": 1,
    "marketplace_event_id": 11,
    "allocated_materials": [
      { "material_id": 789, "material_title": "Winter Jackets", "donation_tag_name": "Clothing", "amount": 500 }
    ],
    "total_amount": 800
  }],
  "meta": { "total": 150, "page": 1, "limit": 50 }
}
```
The existing `allocated_materials` parsing logic already handles this format, so only the URL construction and pagination need to change.

#### Step 3: Fix `allocate-donations-to-marketplace/index.ts`
Rewrite to use `GET /donation-allocations?event_id=11` and `event_id=5` instead of the global `/donations` endpoint. This ensures only items actually allocated to those specific events on Surpluss are synced to GIF.

#### Step 4: Add new actions to `surpluss-allocations-api/index.ts`
- `get_donation_allocations` -- calls `GET /api/common/donation-allocations` with optional `event_id`, `page`, `limit`, `from_date`, `to_date`
- `update_distribution` -- calls `PUT /api/common/donation-allocations/distribution` to report distribution data back to Surpluss

#### Step 5: Deploy and re-sync
Deploy all three updated functions, then trigger a sync for both Feb 28 marketplaces. The correct event-specific allocations will be pulled from Surpluss.

### Files Changed
1. `supabase/functions/sync-surpluss-event-allocations/index.ts` -- Fix URL + add pagination
2. `supabase/functions/allocate-donations-to-marketplace/index.ts` -- Use donation-allocations endpoint per event
3. `supabase/functions/surpluss-allocations-api/index.ts` -- Add `get_donation_allocations` and `update_distribution` actions

### Expected Result
Both Feb 28 marketplaces will show only the items actually allocated to them on the Surpluss platform, with correct quantities matching what the admin expects.

