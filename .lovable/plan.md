

## Reset 147 Morning Cards for Evening Reuse

### Current State
- **145 cards**: `active` status, Morning Event, 0 items collected — activated but never used
- **2 cards**: `active` status, Morning Event, 17 and 18 items collected — these were actually used
- **Afternoon Event** (`ed3f1dfc-...`) is already set up and active

### Fix (data correction via insert tool)

**Step 1: Reset 145 unused cards to reusable state**
```sql
UPDATE qr_cards
SET status = 'inactive',
    marketplace_id = NULL,
    activated_at = NULL,
    credit_balance = 0,
    total_items_collected = 0,
    collected_items = '[]'::jsonb,
    updated_at = now()
WHERE activated_at::date = CURRENT_DATE
  AND status = 'active'
  AND marketplace_id = 'f06dc413-2953-469f-9e07-cb9fddac9bba'
  AND total_items_collected = 0
  AND credit_balance = 0;
```

**Step 2: Check out the 2 actually-used cards** (so they don't block reuse either)
```sql
UPDATE qr_cards
SET status = 'checked_out', updated_at = now()
WHERE activated_at::date = CURRENT_DATE
  AND status = 'active'
  AND marketplace_id = 'f06dc413-2953-469f-9e07-cb9fddac9bba'
  AND total_items_collected > 0;
```

### Result
- 145 cards become `inactive` with no marketplace — ready to scan for the Afternoon Event
- 2 used cards get properly checked out
- No schema changes needed, just data updates

