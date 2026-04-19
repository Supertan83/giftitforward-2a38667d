
User needs to recycle today's Morning event QR cards (the checked-out ones) so they can be reused for this Afternoon's marketplace. Running low on physical cards.

Let me check what's there.
<lov-tool-use id="toolu_vrtx_01Vpto1gQ3XvXwt4fBJdG5pV" name="tool_search" data="{\"target\": \"supabase--read_query\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FY9hPefEopyLGaXsgdtz4h" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT id, name, status, event_date, start_time, end_time FROM marketplace_events WHERE event_date = CURRENT_DATE AND deleted_at IS NULL ORDER BY start_time;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01TPU99g8r86MWxFBArrjVT7" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT status, COUNT(*) FROM qr_cards WHERE marketplace_id = '5404f771-ef88-41d0-a05d-584c36699e67' AND deleted_at IS NULL GROUP BY status;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_012xryDapTsx2Y9CBPVeE9ZY" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT status, COUNT(*) FROM qr_cards WHERE deleted_at IS NULL GROUP BY status;\"}">
</lov-tool-use>
<lov-plan>
Today's events:
- Morning (`5404f771...`): 808 checked_out, 35 active
- Afternoon (`12ec567f...`): starts 15:00, needs cards
- Total inactive (free) pool: 729

The 808 checked_out cards from the morning event need to be reset to `inactive` so they're available for reuse at the afternoon event. Morning data must be archived first to preserve the report.

## Plan (data-only, no code changes)

**Step 1 — Archive morning checked_out cards** into `archived_card_data` (preserves demographics, items collected, timestamps for reporting).

**Step 2 — Reset those 808 cards** to a clean reusable state:
- `status` → `inactive`
- `marketplace_id` → NULL
- `credit_balance` → 0
- `total_items_collected` → 0
- `collected_items` → `[]`
- `gender`, `nationality`, `marital_status`, `children_count` → cleared
- `activated_at` → NULL

**Step 3 — Log** a traceability entry documenting the bulk reset.

```sql
-- 1. Archive
INSERT INTO archived_card_data
  (original_card_id, unique_id, marketplace_id, gender, marital_status, nationality,
   children_count, credit_balance, total_items_collected, collected_items,
   activated_at, checked_out_at, archived_at)
SELECT id, unique_id, marketplace_id, gender, marital_status, nationality,
       children_count, credit_balance, total_items_collected, collected_items,
       activated_at, updated_at, now()
FROM qr_cards
WHERE marketplace_id = '5404f771-ef88-41d0-a05d-584c36699e67'
  AND status = 'checked_out'
  AND deleted_at IS NULL;

-- 2. Reset for reuse
UPDATE qr_cards
SET status = 'inactive',
    marketplace_id = NULL,
    credit_balance = 0,
    total_items_collected = 0,
    collected_items = '[]'::jsonb,
    gender = NULL,
    nationality = NULL,
    marital_status = NULL,
    children_count = 0,
    activated_at = NULL,
    updated_at = now()
WHERE marketplace_id = '5404f771-ef88-41d0-a05d-584c36699e67'
  AND status = 'checked_out'
  AND deleted_at IS NULL;

-- 3. Audit log
INSERT INTO allocation_traceability_logs
  (marketplace_id, marketplace_name, action_type,
   quantity_before, quantity_after, description, performed_by_email)
VALUES
  ('5404f771-ef88-41d0-a05d-584c36699e67',
   'Taxi Drivers Marketplace - Morning Event Day 2',
   'bulk_card_reset',
   808, 0,
   '808 checked_out cards archived and reset to inactive to free pool for Afternoon Event Day 2.',
   'system@manual-fix');
```

## After this runs
- Available inactive cards: **729 + 808 = 1,537** ready for the afternoon
- Morning beneficiary report stays intact (data preserved in `archived_card_data`)
- 35 still-active morning cards left untouched (still in use — they'll naturally check out)
- No code, no workflow changes
