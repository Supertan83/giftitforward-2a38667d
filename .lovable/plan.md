

## Fix: Reset 1,161 Stuck QR Cards from She Thrives (Feb 28)

### The Problem

The earlier "Archive & Reset" failed at the reset step (before the batching fix was applied). As a result:
- **1,161 cards** are still in `checked_out` status linked to She Thrives (marketplace `ff0d8005-7c85-4a8d-9e0c-147475e7b0eb`)
- The activation code (line 227) blocks any `checked_out` card with "This card has already been used today"
- Card `QR-MLTC4HWO-5FWJ` is one of these 1,161 stuck cards
- **These cards will not work at tomorrow's marketplace** unless reset

The good news: the duplicate archived records were already cleaned up (0 records in `archived_card_data` for She Thrives), so there's no double-counting risk.

### Current Card Status Summary

| Status | Count |
|---|---|
| inactive (ready to use) | 907 |
| checked_out (stuck from Feb 28) | 1,169 |
| active (currently in use) | 24 |

### Fix (database update only)

Reset all 1,161 checked_out cards linked to the She Thrives marketplace back to `inactive` so they can be used tomorrow:

```sql
UPDATE qr_cards
SET status = 'inactive',
    credit_balance = 0,
    total_items_collected = 0,
    collected_items = '[]'::jsonb,
    gender = NULL,
    marital_status = NULL,
    nationality = NULL,
    children_count = 0,
    marketplace_id = NULL,
    activated_at = NULL
WHERE marketplace_id = 'ff0d8005-7c85-4a8d-9e0c-147475e7b0eb'
  AND status = 'checked_out';
```

This will:
- Reset 1,161 cards to `inactive` (usable at tomorrow's marketplace)
- Clear all old demographic data from Feb 28
- Remove the She Thrives marketplace link
- **Not** affect the 8 checked_out cards linked to other marketplaces
- **Not** create any archived records (the beneficiary data for She Thrives is already captured in demographics and Surpluss sync)

After this fix, you'll have **2,068 inactive cards** ready for tomorrow's events.

### Why this is safe

- The `archived_card_data` table has 0 records for She Thrives (we deleted the duplicates earlier), so no double-counting
- The She Thrives beneficiary data is already preserved in the marketplace demographics editor and was synced to Surpluss — card-level data is not needed
- The batching fix from the previous update ensures future Archive & Reset operations will work correctly for large card volumes

