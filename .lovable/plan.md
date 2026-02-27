

## Fix Swapped External IDs and Re-Sync Allocations

### Current State (Verified via API)

Only **one** Surpluss event currently has allocation data:

| Surpluss event_id | Items on Surpluss API | Currently mapped to (GIF) |
|---|---|---|
| **4** | **38,940 pieces** (30 materials) | March 7 First Half (wrong) |
| 5 | 0 pieces | Feb 28 Second Half |
| 11 | 0 pieces | Feb 28 First Half |
| 12 | 0 pieces | March 7 Second Half |

The 38,940 pieces sitting under March 7 likely belong to Feb 28 (since the Feb 28 event is tomorrow and the Surpluss platform shows items under "She Thrives Women Workers Marketplace February 28").

### Fix Plan (3 steps via edge function)

#### Step 1: Swap external_ids between Feb 28 First Half and March 7 First Half
```text
Feb 28 First Half (ff0d8005): external_id 11 -> 4
March 7 First Half (1938adf3): external_id 4 -> 11
```
This assigns event_id=4 (the one with 38,940 pieces) to Feb 28 where it belongs.

#### Step 2: Delete the 30 incorrect allocation records from March 7 First Half
These 30 records (38,940 pieces, 0 distributed) were synced to the wrong marketplace. They have zero distributions so deletion is safe.

#### Step 3: Re-sync Feb 28 First Half
Trigger `sync-surpluss-event-allocations` for the Feb 28 First Half marketplace. With the corrected external_id=4, it will pull the correct 38,940 pieces.

#### Step 4: Validate totals
Query both marketplaces to confirm:
- Feb 28 First Half: ~30 records, ~38,940 allocated pieces
- March 7 First Half: 0 records (until Surpluss adds allocations for event_id=11)

### Implementation
A single edge function `fix-swapped-external-ids` will:
1. Verify both marketplaces exist and have the expected current external_ids (safety check)
2. Swap the external_ids in a single transaction
3. Delete `marketplace_item_allocations` for March 7 First Half (the wrongly-synced records)
4. Log the operation to `surpluss_api_audit_log`
5. Return a summary of changes

After deploying, we call the function, then trigger a sync for Feb 28 to pull the correct data.

### Safety Measures
- Pre-flight check: abort if external_ids don't match expected values (11 and 4)
- Pre-flight check: abort if March 7 has any non-zero `distributed_quantity` (meaning items were already given out)
- All changes logged to audit table for reversibility
- The edge function is a one-time operation and can be deleted after use

### Files
1. `supabase/functions/fix-swapped-external-ids/index.ts` -- one-time fix function (create, run, delete)

