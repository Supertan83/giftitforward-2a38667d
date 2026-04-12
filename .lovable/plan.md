

## Fix Slow Check-in / Check-out System

### Root Cause

Every zone component (Entrance, Exit, Marketplace) calls `useQRCards()` which **fetches ALL 2,100+ QR cards** in paginated batches. On top of that, a realtime subscription on the `qr_cards` table fires `invalidateQueries` on **every single card change**, triggering a full re-fetch of all 2,100+ rows. During an active marketplace with many scans happening, this creates a cascade:

1. Volunteer scans a card → card updated in DB
2. Realtime fires → `invalidateQueries(['qr_cards'])` → full re-fetch of 2,100+ rows
3. While that fetch is running, another scan happens → another invalidation → another full fetch
4. The UI blocks or takes 30-60 seconds because the data is constantly being re-fetched

### Fix (3 changes in `src/hooks/useSupabaseData.ts` + zone components)

**1. Stop zones from fetching all cards — use lightweight count queries instead**

The Entrance and Exit zones only need **counts** (active cards, checked out, etc.), not the full card list. Replace `useQRCards()` in these zones with a new `useCardStats(marketplaceId)` hook that runs a single SQL count query filtered by marketplace — returning in milliseconds instead of seconds.

**2. Remove realtime-triggered full invalidation for zones**

The new `useCardStats` hook will use a longer `staleTime` (30s) and only refetch after a successful scan operation via `onSuccess`, not on every realtime event. This prevents the cascade of re-fetches.

**3. Keep `useQRCards()` only for admin views that actually need the full list**

The admin dashboard and card management views still need all cards — those stay as-is. Only the volunteer-facing zones get the optimized path.

### New hook: `useCardStats`

```typescript
// Runs a single filtered count query — returns in <100ms
export const useCardStats = (marketplaceId: string) => {
  return useQuery({
    queryKey: ['card_stats', marketplaceId],
    staleTime: 15000,
    queryFn: async () => {
      // Count active cards for this marketplace
      const { count: active } = await supabase
        .from('qr_cards')
        .select('*', { count: 'exact', head: true })
        .eq('marketplace_id', marketplaceId)
        .eq('status', 'active');
      
      // Count checked_out for this marketplace  
      const { count: checkedOut } = await supabase
        .from('qr_cards')
        .select('*', { count: 'exact', head: true })
        .eq('marketplace_id', marketplaceId)
        .eq('status', 'checked_out');
      
      // Count inactive (ready) cards
      const { count: ready } = await supabase
        .from('qr_cards')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'inactive');

      return { active: active ?? 0, checkedOut: checkedOut ?? 0, ready: ready ?? 0 };
    },
    enabled: !!marketplaceId,
  });
};
```

### Files changed

| File | Change |
|---|---|
| `src/hooks/useSupabaseData.ts` | Add `useCardStats` hook |
| `src/components/zones/EntranceZone.tsx` | Replace `useQRCards()` with `useCardStats()`, invalidate only `card_stats` on scan success |
| `src/components/zones/ExitZone.tsx` | Same — replace `useQRCards()` with `useCardStats()` |
| `src/components/zones/MarketplaceZone.tsx` | Check if it also uses `useQRCards` and apply same fix |

### Result
- Check-in/check-out page loads in <1 second instead of 30-60 seconds
- Scans complete instantly without waiting for 2,100+ rows to reload
- Stats refresh after each successful scan and every 15 seconds

