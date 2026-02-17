

## Speed Up Marketplace QR Scan (Without Affecting Other Flows)

### What changes
Only the **Marketplace Zone** distribute/return path gets optimized. The existing flows for Entrance (check-in), Exit (check-out), and other zones remain completely untouched -- they continue using the same `activateCard`, `checkoutCard`, `distributeItem`, and `returnItem` functions as before.

### Why it's safe
- `distributeItemSimple` and `returnItemSimple` are **only called by MarketplaceZone** -- no other component uses them
- The new database functions replicate the exact same logic (find card, validate, update balance, insert transaction, increment allocation) but execute it in a single round-trip instead of multiple sequential calls
- The existing `distributeItem`, `returnItem`, `activateCard`, `checkoutCard` functions in `useSupabaseData.ts` are not modified at all

### Changes

**1. Database migration -- two new functions**

- `distribute_marketplace_item(p_unique_id, p_marketplace_id)`: Finds the card, validates status/limit, updates balance (+1), inserts a Distribution transaction, finds an allocation with remaining stock, increments its distributed count, returns new balance -- all in one atomic call.
- `return_marketplace_item(p_unique_id, p_marketplace_id)`: Same but in reverse -- decrements balance, inserts Return transaction, decrements allocation distributed count.

**2. `src/hooks/useSupabaseData.ts`**

Replace the `distributeItemSimple` mutation body with a single `supabase.rpc('distribute_marketplace_item', ...)` call. Same for `returnItemSimple` with `return_marketplace_item`. Remove the `onSuccess` invalidation of `qr_cards` (not needed here -- MarketplaceZone only cares about the allocation count). Keep `marketplace_allocations` invalidation but make it non-blocking (no `await`).

**3. `src/components/zones/MarketplaceZone.tsx`**

- Remove the separate `incrementDistributed` / `decrementDistributed` calls after scanning (the DB function handles this now)
- Remove `await refetchAllocations()` -- use optimistic local state update via React Query's `setQueryData` so the stats update instantly
- Keep the same UI, feedback overlays, and error handling

**4. `src/components/QRScanner.tsx`**

- Reduce the post-scan delay from 500ms to 100ms (line 121: `setTimeout(() => { onScan(...) }, 500)` changed to 100ms) so the callback fires faster after a successful scan

### What stays the same
- Entrance Zone check-in flow (activateCard)
- Exit Zone check-out flow (checkoutCard)  
- Non-marketplace distribute/return (distributeItem, returnItem)
- All QR card queries, volunteer card flows, manual counts
- Database tables structure -- no schema changes, only new functions added

