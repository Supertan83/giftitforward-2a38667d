## Fix: clear stale marketplace on checked-out cards

### Root cause
`checkout_beneficiary_card` zeroes balances but leaves `marketplace_id` and `activated_at` pointing at the previous event, so the Card Status panel keeps displaying an old marketplace name. The same is true for `auto-unblock-cards` if it doesn't null those fields.

### Changes

**1. Migration — update `checkout_beneficiary_card` RPC**
Add to the UPDATE inside the function:
```
marketplace_id = NULL,
activated_at = NULL,
```
Everything else (transaction insert, return payload) stays the same. The `CheckOut` transaction row still records `v_card.marketplace_id` so history is preserved.

**2. Migration — one-time data cleanup**
For all `qr_cards` where `status = 'checked_out'`, set `marketplace_id = NULL` and `activated_at = NULL`. Does not touch `inactive` or `active` cards, does not touch transactions, does not touch counts/credits.

**3. Verify `auto-unblock-cards` edge function**
Read `supabase/functions/auto-unblock-cards/index.ts` and, if it resets cards without nulling `marketplace_id` / `activated_at`, add those two fields to its UPDATE so reset cards also display "None".

### Out of scope
- No UI changes — the existing `marketplace?.name || 'None'` rendering already handles a null marketplace.
- No changes to `transactions`, allocation counters, or any other RPC.
- Active cards in today's marketplace are not touched.