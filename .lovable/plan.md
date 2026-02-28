
# Fix: Beneficiary Checkout Latency (5-10s down to ~200ms)

## Root Cause Analysis

The checkout flow in ExitZone currently makes **4 sequential network calls**, and then triggers a **full table reload of 2100+ cards**:

1. `findCardByUniqueId(code)` -- SELECT from qr_cards (just to get `totalItemsCollected`)
2. `checkoutCard.mutateAsync(code)` which internally does:
   - SELECT from qr_cards (duplicate lookup)
   - UPDATE qr_cards
   - INSERT into transactions
3. `invalidateQueries(['qr_cards'])` -- re-fetches ALL 2100 cards (paginated 1000 at a time = 3 round-trips)

Total: ~7 sequential network round-trips. At ~500-800ms each in field conditions, that's 5-10 seconds.

## Solution: Single-Transaction RPC (same pattern as distribution)

The distribution and return flows already use atomic RPC functions (`distribute_marketplace_item`, `return_marketplace_item`) that complete in ~200ms. Checkout should follow the same pattern.

### Step 1: Create a database RPC function `checkout_beneficiary_card`
- Single atomic function that does: find card, validate, update status to `checked_out`, reset balances, insert CheckOut transaction
- Returns `totalCollected` so the UI can display the summary
- Includes `auth.uid()` and marketplace_id tracking

### Step 2: Update `checkoutCard` mutation in `useSupabaseData.ts`
- Replace the 3 sequential queries with a single `supabase.rpc('checkout_beneficiary_card', { p_unique_id: cleanId })`
- Use the returned `totalCollected` directly instead of pre-fetching

### Step 3: Remove redundant `findCardByUniqueId` call in ExitZone
- The RPC returns `totalCollected`, so ExitZone no longer needs to call `findCardByUniqueId` before checkout
- Removes one extra network round-trip

### Step 4: Use optimistic cache update instead of full refetch
- After checkout, update the single card in the local query cache instead of invalidating the entire `qr_cards` query (which re-fetches 2100+ rows)
- Still invalidate in background for consistency, but the UI updates instantly

## Expected Result
- **Before**: 4+ sequential queries + full table reload = 5-10 seconds
- **After**: 1 RPC call + optimistic cache update = ~200ms

This matches the existing pattern used for distribution scans, which volunteers already confirmed is fast.

## Technical Details

### New RPC function
```sql
CREATE OR REPLACE FUNCTION public.checkout_beneficiary_card(p_unique_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card record;
  v_clean_id text;
  v_collected integer;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_clean_id := TRIM(p_unique_id);

  SELECT * INTO v_card
  FROM public.qr_cards
  WHERE lower(unique_id) = lower(v_clean_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  v_collected := v_card.total_items_collected;

  UPDATE public.qr_cards
  SET status = 'checked_out',
      credit_balance = 0,
      total_items_collected = 0,
      collected_items = '[]'::jsonb
  WHERE id = v_card.id;

  INSERT INTO public.transactions (card_id, type, credit_change, scanned_by, marketplace_id)
  VALUES (v_card.id, 'CheckOut', 0, auth.uid(), v_card.marketplace_id);

  RETURN json_build_object(
    'totalCollected', v_collected,
    'cardId', v_card.id,
    'uniqueId', v_card.unique_id
  );
END;
$$;
```

### Files changed
1. **Database migration** -- new `checkout_beneficiary_card` RPC
2. **`src/hooks/useSupabaseData.ts`** -- replace `checkoutCard` mutation body with single RPC call + optimistic update
3. **`src/components/zones/ExitZone.tsx`** -- use returned `totalCollected` from mutation instead of pre-fetching with `findCardByUniqueId`
