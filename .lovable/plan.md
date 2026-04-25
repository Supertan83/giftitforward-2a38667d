# Plan: Move 153 Active QR Cards from Morning to Afternoon Event (Option A)

## Goal
Recycle the 153 currently-active beneficiary cards from the **Morning** event so the same physical QR cards can be handed out at the **Afternoon** event tonight — without losing the morning's 13,834 transactions or its reporting numbers.

## Source / Target
- **Morning event** (source): `cedfb6a2-41f6-4b86-b8b8-53fe867fb750` — Inclusive Community: Family and People of Determination Marketplace - Morning Event
- **Afternoon event** (target): `71792e7c-9f98-4103-bd26-0aec8e5f0ad6` — Afternoon Event

## Steps

### 1. Archive Morning's 153 active cards
Force `status = 'checked_out'` on all `qr_cards` rows where `marketplace_id = <morning>` AND `status = 'active'`. This:
- Preserves all 13,834 morning transactions and `total_items_collected` for reports.
- Frees the physical QR codes for re-issue.
- Inserts a `CheckOut` transaction row per card (audit trail, scanned_by = NULL = system).

### 2. Recycle the 153 physical cards into the Afternoon event
Insert 153 new rows into `qr_cards` with:
- Same `unique_id` as the morning cards (physical QR is identical).
- `marketplace_id` = Afternoon (`71792e7c-…`).
- `status = 'inactive'`, `credit_balance = 0`, `total_items_collected = 0`, `collected_items = '[]'`.
- Fresh `created_at = now()`, no `activated_at`.

This matches the documented QR Card Lifecycle pattern (mem://system/qr-card-lifecycle-management) where physical cards get a fresh row per event.

### 3. Soft-delete duplicate Morning event row
`UPDATE marketplace_events SET deleted_at = now() WHERE id = '43289a4a-fe35-4e20-bbf5-1d98d87f1065'` to prevent future Surpluss sync confusion.

### 4. Verification (read-only checks)
- Morning event: 0 active cards, 153 newly checked-out, 13,834 transactions intact.
- Afternoon event: 153 new `inactive` cards ready for Entrance Zone scan-in.
- Duplicate event row hidden from all admin lists.

## Out of Scope (per Option A)
- No Afternoon allocation sync triggered. If Afternoon's inventory is still empty, run "Sync Allocations" from Marketplace Reports separately when ready.

## Technical Detail (SQL pseudo-summary)
```sql
-- Step 1: archive
UPDATE qr_cards SET status='checked_out', credit_balance=0,
  collected_items='[]', updated_at=now()
WHERE marketplace_id='cedfb6a2-...' AND status='active';

INSERT INTO transactions (card_id, type, credit_change, marketplace_id)
SELECT id, 'CheckOut', 0, marketplace_id FROM qr_cards
WHERE marketplace_id='cedfb6a2-...' AND status='checked_out'
  AND updated_at >= now() - interval '1 minute';

-- Step 2: recycle
INSERT INTO qr_cards (unique_id, marketplace_id, status,
  credit_balance, total_items_collected, collected_items)
SELECT unique_id, '71792e7c-...', 'inactive', 0, 0, '[]'::jsonb
FROM qr_cards
WHERE marketplace_id='cedfb6a2-...' AND status='checked_out'
  AND updated_at >= now() - interval '1 minute';

-- Step 3: soft-delete duplicate
UPDATE marketplace_events SET deleted_at=now()
WHERE id='43289a4a-fe35-4e20-bbf5-1d98d87f1065';
```

## Result
The volunteer team can scan the same 153 physical cards at the Afternoon Entrance Zone and they will be treated as fresh, unregistered cards — while the Morning event's stats stay frozen and accurate.
