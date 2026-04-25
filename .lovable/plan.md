## Plan: Fix Afternoon Event Card Count & Activate Marketplace

### Step 1: Trim 42 extra Afternoon cards
Soft-delete the 42 most recently activated cards in the Afternoon event to return to the target 153 active cards.

```sql
UPDATE qr_cards 
SET deleted_at = now(), updated_at = now()
WHERE id IN (
  SELECT id FROM qr_cards 
  WHERE marketplace_id = '71792e7c-9f98-4103-bd26-0aec8e5f0ad6'
    AND status = 'active' 
    AND deleted_at IS NULL
  ORDER BY activated_at DESC NULLS LAST, created_at DESC
  LIMIT 42
);
```

### Step 2: Activate Afternoon marketplace event
```sql
UPDATE marketplace_events 
SET status = 'active', updated_at = now()
WHERE id = '71792e7c-9f98-4103-bd26-0aec8e5f0ad6';
```

### Step 3: Keep credit limits at 20
No change — both events stay at `beneficiary_credit_limit = 20`.

### Verification
- Confirm Afternoon active card count = 153
- Confirm Afternoon marketplace status = 'active'
- Confirm Morning event remains untouched

### Expected Result
- Morning event: stats unchanged (322 checked out, "X / 20" display)
- Afternoon event: 153 active cards, status = active, ready for distribution