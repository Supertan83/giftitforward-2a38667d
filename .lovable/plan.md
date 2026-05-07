## Problem

The "Checked Out" stat on the Exit Zone shows **0** even though 7–10 beneficiaries have been checked out. The "Still Active" counter (309) is correct.

## Root cause

Earlier today we fixed the Card Status panel by changing `checkout_beneficiary_card` to **null out `marketplace_id`** on checkout (so cards no longer show an old marketplace name).

The Exit Zone counter in `useCardStats` (src/hooks/useSupabaseData.ts) counts checked-out cards with this filter:

```
qr_cards
  .eq('marketplace_id', selectedMarketplaceId)
  .eq('status', 'checked_out')
  .gte('updated_at', todayDubaiStart)
```

Since today's checked-out cards now have `marketplace_id = NULL`, they no longer match `marketplace_id = selectedMarketplaceId` — so the count is always 0. The check-outs ARE happening (DB is updated, transactions are written); only the stat is wrong.

## Fix

Update the **`checkedOut` count query only** in `useCardStats` to drop the `marketplace_id` filter and rely on `status = 'checked_out'` + today's `updated_at` window (Asia/Dubai):

```
qr_cards
  .eq('status', 'checked_out')
  .gte('updated_at', todayDubaiStart)
```

This is safe because:
- Only one marketplace event runs per day, so "checked out today" unambiguously means today's event.
- Historical checked-out cards from previous days are excluded by the `updated_at >= today` filter.
- The `Still Active` count is unchanged (active cards still have `marketplace_id` set).
- The `todayCheckIns` count is unchanged (uses `activated_at`, which is set on check-in).

## Scope

- One file: `src/hooks/useSupabaseData.ts`
- One query inside `useCardStats` (the `checkedOutRes` block)
- No DB migration, no RPC change, no UI change

After the fix, the Exit Zone "Checked Out" tile will immediately reflect today's actual check-out count.
