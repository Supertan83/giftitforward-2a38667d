## Problem

When a beneficiary is checked out at the Exit zone, the card is left in `status = 'checked_out'` with `marketplace_id = NULL` and `activated_at = NULL`. Everything is already wiped — the "checked_out" status is essentially a tombstone waiting for the next nightly auto-unblock sweep to flip it to `inactive`.

But once the auto-unblock cron has already run for the day, any check-outs that happen afterwards stay in `checked_out` until tomorrow. That's why the QR Control Center still shows `QR-MLS7W4O9-LHLV` as "checked out from May 3 marketplace" — the row was actually checked out today (May 7), missed today's sweep, and now reads as a stale ghost (the only event link left is in `transactions`, which is the May 3 event).

There are 9 such stranded cards in the DB right now.

## Fix

Skip the `checked_out` middle state entirely. When a card is checked out it should go straight back to `inactive` (Ready) — the data is already cleared, so there's nothing to preserve.

### Step 1 — Update the checkout RPC

Modify `checkout_beneficiary_card` so the final UPDATE sets `status = 'inactive'` instead of `'checked_out'`. Everything else stays the same: balance, items, marketplace_id, activated_at all wiped, and a `CheckOut` transaction is still inserted (so reports/history are unchanged).

### Step 2 — One-time backfill

Reset the 9 currently-stranded cards (`status='checked_out'` AND `marketplace_id IS NULL` AND `activated_at IS NULL`) to `inactive` so the user sees them as Ready immediately.

### Step 3 — Leave auto-unblock as-is

The cron job remains as a safety net for genuinely abandoned `active` cards from prior events. No changes needed there.

## What stays the same

- `transactions` table is untouched — distribution and check-out history is preserved.
- The Exit zone flow, scan feedback, and confetti behavior — the RPC response shape is unchanged.
- Auto-unblock cron schedule and logic.
- RLS policies and the `card_status` enum (we just stop writing the `checked_out` value going forward; the enum value can remain for backwards compatibility).

## Expected outcome

- Checking out a card at Exit instantly returns it to `Ready` — no lag waiting for cron.
- QR Control Center will never show "checked_out" again for cards that have been properly checked out.
- The 9 currently stuck cards (including `QR-MLS7W4O9-LHLV`) become Ready immediately after the migration runs.
