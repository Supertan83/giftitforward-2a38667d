## Problem

The Exit Zone "Checked Out" counter shows ~133 (or 80+ depending on time), but real check-outs today are under 50.

## Root cause

Earlier today, a backfill migration ran:

```sql
UPDATE qr_cards
SET marketplace_id = NULL, activated_at = NULL, updated_at = now()
WHERE status = 'checked_out' AND ...;
```

This bumped `updated_at` on **every historical checked-out card** to today's timestamp. The current `useCardStats` query counts `status = 'checked_out' AND updated_at >= todayDubaiStart`, so it now counts every old card as if it were checked out today.

DB confirms: 80+ cards have `status='checked_out'` with `updated_at` falling on today's Dubai date — but only the genuinely-checked-out-today subset should count.

## Fix

Switch the "Checked Out" stat to count from the `transactions` table (source of truth, immutable, has accurate `timestamp`) instead of relying on `qr_cards.updated_at` (which was rewritten by the backfill).

Update the `checkedOutRes` block in `useCardStats` (`src/hooks/useSupabaseData.ts`) to:

```ts
supabase
  .from('transactions')
  .select('*', { count: 'exact', head: true })
  .eq('type', 'CheckOut')
  .eq('marketplace_id', marketplaceId)
  .gte('timestamp', todayDubaiStartISO)
```

Why this works:
- `transactions` rows are inserted once at checkout and never mutated, so the backfill didn't touch them.
- Each successful `checkout_beneficiary_card` RPC call inserts exactly one `CheckOut` transaction, so count = today's real check-outs.
- Filtering by `marketplace_id` (preserved on the transaction row even though it's nulled on the card) scopes it to the active event.

## Scope

- One file: `src/hooks/useSupabaseData.ts`
- One query (the `checkedOutRes` block inside `useCardStats`)
- No DB migration, no RPC change, no UI change

After the fix, the "Checked Out" tile will reflect today's actual check-out transaction count for the selected marketplace.
