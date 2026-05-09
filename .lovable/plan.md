## Problem

On the Entrance Zone (Check-in Kiosk), the **Checked Out** stat shows `0` for the active marketplace, even though the database has ~196 `CheckOut` transactions today for that marketplace. After deeper inspection, **Today's Check-ins** is also undercounted (UI: 309, real check-ins today: ~511).

### Root cause

Both stats are queried in `useCardStats` (`src/hooks/useSupabaseData.ts`, ~lines 161–209) and both rely on `qr_cards.marketplace_id`, but our checkout RPC (`checkout_beneficiary_card`) **wipes `marketplace_id` to NULL** when a beneficiary checks out:

- `Today's Check-ins` query: `qr_cards where marketplace_id = X and activated_at >= today` → loses every card after it's checked out.
- `Checked Out` query: counts `transactions` of type `CheckOut` filtered by `marketplace_id`. The SQL is correct in isolation (returns 196 in DB), but in practice it's returning `0` in the UI. Most likely cause: the transactions row's `marketplace_id` is being set correctly but a small RLS / count interaction (`head: true` + `count: exact` on a SELECT-restricted table) is returning `null`. Switching this stat to the same source as Today's Check-ins (and using a SECURITY DEFINER RPC) removes the ambiguity entirely.

## Fix

Add one small SECURITY DEFINER SQL function and switch the two affected stats to it. No UI/markup changes — only the data hook changes.

### 1. Database

Create `public.get_marketplace_kiosk_stats(p_marketplace_id uuid)` returning JSON with:
- `today_check_ins`: `COUNT(*)` from `transactions` where `type='CheckIn' AND marketplace_id = p_marketplace_id AND timestamp >= start of Dubai day`
- `checked_out`: same with `type='CheckOut'`
- `active`: `COUNT(*)` from `qr_cards` where `marketplace_id = p_marketplace_id AND status='active'`
- `ready`: `COUNT(*)` from `qr_cards` where `status='inactive'` (unchanged definition)

Function uses `is_staff(auth.uid())` guard, `SET search_path = public`, and computes the Dubai-midnight cutoff in SQL (`(date_trunc('day', now() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai')`).

### 2. Frontend

In `src/hooks/useSupabaseData.ts` `useCardStats`:
- Replace the four parallel `.from(...).select('*', { count: 'exact', head: true })` calls with a single `supabase.rpc('get_marketplace_kiosk_stats', { p_marketplace_id: marketplaceId })`.
- Map the returned JSON to the existing `{ active, checkedOut, ready, todayCheckIns }` shape consumed by `EntranceZone`. No component changes needed.

### Why this resolves the report

- `Checked Out` will pull the same value SQL returns directly (196), bypassing the silent count/RLS behavior.
- `Today's Check-ins` will now match reality even after beneficiaries are checked out, because `transactions.marketplace_id` is preserved (`v_prev_marketplace_id` is captured before clearing the qr_card).

## Out of scope

- No changes to checkout RPC behavior (intentional that a checked-out card is detached so it can be reused next day).
- No UI/visual changes.
- Volunteer/admin views, exit zone, and reports are unaffected.
