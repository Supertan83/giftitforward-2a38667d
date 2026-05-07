## Problem

The "Checked Out" tile updates only on the device that scanned the card (because that device manually invalidates `card_stats`). When **another device** activates a card at the Entrance, the Exit Zone tile stays the same — it only re-fetches when its own user does something or when the page reloads.

DB confirms the data itself is correct right now:
- Construction Workers: **88 active cards** in `qr_cards`
- All-marketplace active total: **94**

So the bug is purely a UI freshness problem, not a counting bug.

## Fix

Make the stats tile self-refresh, so any device sees up-to-date numbers without manual reload.

Two changes, both inside `src/hooks/useSupabaseData.ts` → `useCardStats`:

1. **Polling**: add `refetchInterval: 10000` and `refetchOnWindowFocus: true` so the tile refreshes every 10 s automatically and immediately when the operator returns to the tab. Drop `staleTime` to `0` so polled data is always shown fresh.

2. **Realtime push**: subscribe to `qr_cards` and `transactions` postgres-changes inside a small effect-driven companion hook (or directly inside the React Query `queryFn` setup using `useEffect` + `supabase.channel`). On any insert/update event for the selected marketplace, call `queryClient.invalidateQueries(['card_stats', marketplaceId])`. This gives near-instant cross-device updates while polling acts as a safety net if the websocket drops.

Realtime requires the two tables to be in the `supabase_realtime` publication. Add a migration:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER TABLE public.qr_cards REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
```

(If either table is already in the publication the `ADD TABLE` will no-op via `IF NOT EXISTS`-style guard in the migration.)

## Scope

- `src/hooks/useSupabaseData.ts` — update `useCardStats` (polling + realtime subscription + invalidation)
- One migration to enable realtime on `qr_cards` and `transactions`
- No UI/component changes, no RPC changes, no other queries touched

After this:
- Entrance, Exit, and Admin views all reflect the same live numbers within ~1 s of any check-in / check-out, regardless of which device performed it.
- "Checked Out" goes up on every checkout, "Active Cards" goes up on every activation, both across all devices.
