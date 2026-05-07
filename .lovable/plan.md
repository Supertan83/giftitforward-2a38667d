## Add "Reset to Ready" button on QR Control Center

Lets admins manually reset a single QR card back to **Ready (inactive)** — useful when a card is stuck in `checked_out` or `active` with stale data and shouldn't wait for the nightly sweep.

### 1. New RPC: `admin_reset_qr_card`
Migration adds a SECURITY DEFINER function that:
- Requires `has_role(auth.uid(), 'admin')`
- Looks up the card by `unique_id`
- Captures previous `marketplace_id` + `total_items_collected` for the audit trail
- Updates the row to: `status = 'inactive'`, `credit_balance = 0`, `total_items_collected = 0`, `collected_items = '[]'`, `marketplace_id = NULL`, `activated_at = NULL`
- Inserts a `CheckOut` transaction (so reports stay consistent with the existing checkout flow)
- Returns `{ cardId, uniqueId, previousStatus, totalCollected }`

### 2. UI change in `BeneficiaryQRControlCenter.tsx`
In the **Card Status** card, add a "Reset to Ready" button (admin-only, shown only when `card.status !== 'inactive'`):
- Uses the existing admin-role check pattern already in the file
- Confirmation dialog warning that balance, items, and marketplace link will be wiped
- Calls `supabase.rpc('admin_reset_qr_card', { p_unique_id })`
- On success: toast "Card reset to Ready", refresh card data + transactions list

### Notes
- No changes to the existing `checkout_beneficiary_card` RPC or auto-unblock cron.
- The 9-card backfill from earlier already cleared current stragglers; this button is for future one-offs.
