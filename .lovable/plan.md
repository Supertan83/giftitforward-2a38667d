

## Recycle Morning Cards for Afternoon Event

### Current State
- **33 cards** still `active` on Morning Event — need to be checked out first
- **1,074 cards** already `checked_out` on Morning Event
- **Afternoon Event** (`3e0ddc6e-5e20-4ab4-9e81-51f2ae2dbd63`) exists with `upcoming` status

### Steps (all data operations via insert tool)

**Step 1: Check out the 33 still-active cards**
```sql
UPDATE qr_cards
SET status = 'checked_out', credit_balance = 0, total_items_collected = 0,
    collected_items = '[]'::jsonb, updated_at = now()
WHERE marketplace_id = '6ed111b0-f003-46e8-a719-d76cc1800431'
  AND status = 'active';
```

**Step 2: Reset all 1,107 cards to inactive (ready for reuse)**
```sql
UPDATE qr_cards
SET status = 'inactive', marketplace_id = NULL, credit_balance = 0,
    total_items_collected = 0, collected_items = '[]'::jsonb,
    activated_at = NULL, updated_at = now()
WHERE marketplace_id = '6ed111b0-f003-46e8-a719-d76cc1800431'
  AND status = 'checked_out';
```

**Step 3: Set Afternoon Event to active**
```sql
UPDATE marketplace_events
SET status = 'active', updated_at = now()
WHERE id = '3e0ddc6e-5e20-4ab4-9e81-51f2ae2dbd63';
```

**Step 4: Set Morning Event to completed**
```sql
UPDATE marketplace_events
SET status = 'completed', updated_at = now()
WHERE id = '6ed111b0-f003-46e8-a719-d76cc1800431';
```

### Result
- All 1,107 cards become `inactive` with no marketplace — ready to scan into the Afternoon Event
- Morning Event marked completed, Afternoon Event marked active
- Volunteers can scan cards at entrance to activate them for the afternoon

