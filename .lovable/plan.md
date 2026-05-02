## Current State (Saturday, May 2, 2026 — Dubai)

Today's events: Single Mothers Household Workers — Morning (ended 15:00) and Afternoon (ends 20:00). Tomorrow: Single Mothers Marketplace Morning + Afternoon Event 2 (May 3).

QR card snapshot (total 1,957 cards):
- **900 inactive** — ready for use
- **42 active** — checked in but never checked out (37 from Morning that already ended, 5 from Afternoon still running)
- **1,015 checked_out** — used today, holding old marketplace_id and balance data

If we do nothing, the existing midnight cron (`auto-unblock-qr-cards-midnight` at 00:00 Dubai + safety-net at 03:30) will reset all of these tonight because their `activated_at` is before tomorrow's Dubai-day boundary. So tomorrow morning **should** wake up with all 1,957 cards inactive — but we want belt-and-suspenders to avoid the issue from last weekend.

## Goal

Guarantee that by tomorrow morning every beneficiary QR card is `inactive`, has zero balance, no `marketplace_id`, and no `activated_at`, so check-in shows the full ~1,957 ready pool.

## Plan

### 1. Force-checkout the 37 stuck Morning-event cards now
The Morning event ended at 15:00 but 37 beneficiaries were never checked out. Run a one-shot script to:
- For each `qr_cards` row with `status='active'` AND `marketplace_id = 27cad0fe…` (Morning):
  - Insert a `CheckOut` transaction (so distribution counts/reports stay accurate)
  - Then run the standard reset (status → `inactive`, clear balance, items, marketplace_id, activated_at)

Leave the 5 Afternoon cards alone for now — that event is still live until 20:00; volunteers may still scan checkouts. The cron will sweep them tonight.

### 2. Run the existing `auto-unblock-cards` edge function manually right after the Afternoon event ends
This validates end-to-end that the overnight reset works and surfaces any failure tonight rather than tomorrow at 6 AM. It will:
- Auto-complete both Single Mothers events (Morning will already be past end_time; Afternoon will be after 20:00)
- Reset every card whose `activated_at < Dubai today-start` (tomorrow's run) — so we'll invoke once tonight after 20:00 and confirm ~1,057 cards reset

### 3. Verification queries
After the manual run, confirm:
- `qr_cards`: 1,957 inactive / 0 active / 0 checked_out / 0 with marketplace_id
- `marketplace_events` for today: status = `completed`
- `BeneficiaryQRControlCenter` "Ready" count shows ~1,957

### 4. No code changes required
The fixes to `auto-unblock-cards` (handle stuck `checked_out` and orphaned `marketplace_id` rows) were already shipped earlier this week. This task is purely operational: a one-shot SQL/script and a manual edge-function invocation tonight.

### Technical details

One-shot reset script for the 37 Morning-event stuck active cards (run via insert-only SQL; safe because we insert CheckOut transactions then update qr_cards):

```sql
-- 1. Log a CheckOut transaction for each stuck active card on the Morning event
INSERT INTO transactions (card_id, type, credit_change, marketplace_id)
SELECT id, 'CheckOut', 0, marketplace_id
FROM qr_cards
WHERE deleted_at IS NULL
  AND status = 'active'
  AND marketplace_id = '27cad0fe-2274-484e-ab36-92261a62287b';

-- 2. Reset those cards (requires migration — UPDATE not in insert scope)
UPDATE qr_cards
SET status = 'inactive',
    credit_balance = 0,
    total_items_collected = 0,
    collected_items = '[]'::jsonb,
    marketplace_id = NULL,
    activated_at = NULL,
    updated_at = now()
WHERE deleted_at IS NULL
  AND status = 'active'
  AND marketplace_id = '27cad0fe-2274-484e-ab36-92261a62287b';
```

Then tonight after 20:00 Dubai (Afternoon event ends), invoke:
```
POST /functions/v1/auto-unblock-cards
```
and confirm response shows ~1,020 cards reset and 2 marketplaces auto-completed.

### Risk / rollback
- Pre-checkout of the 37 Morning cards is safe: those beneficiaries already left the venue hours ago; the CheckOut transaction preserves the audit trail.
- We will NOT touch the 5 Afternoon cards or 1,015 already-checked-out cards manually; the existing cron handles them.
