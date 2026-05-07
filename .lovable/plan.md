## Why scanning is slow right now

After investigating live data, the bottleneck is **not** the scan RPCs themselves — it's the cascade of dashboards and stats queries that re-run on every scan.

Findings:
- `transactions` has **306,280 rows** and only a primary-key index. Any filter on `marketplace_id` / `type` / `timestamp` does a **parallel sequential scan (~300ms)**.
- `useCardStats` (used by Entrance, Exit, Marketplace, Stats zones) runs **4 count queries** every refresh — one of them is the slow CheckOut/transactions filter.
- `useCardStats` subscribes to **every `transactions` INSERT** via realtime and immediately re-invalidates. Distribution RPCs insert one transaction row **per item** (and `generate_series` for batches), so a single 10-item scan triggers 10 invalidations across every connected admin client. Each invalidation fires the 300ms transactions count again → snowballs.
- `useQRCards` (used by Unblock zone, Stats Dashboard, QR Generator, Sync panel) fetches **all 2,255 rows** and is invalidated on every `qr_cards` change. With several admins logged in, this is constantly re-fetching during scans.

## Plan

### 1. Add database indexes (migration)
```
CREATE INDEX IF NOT EXISTS idx_transactions_marketplace_type_timestamp
  ON public.transactions (marketplace_id, type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_card_id
  ON public.transactions (card_id);

CREATE INDEX IF NOT EXISTS idx_transactions_timestamp
  ON public.transactions (timestamp DESC);
```
Expected: the CheckOut count query drops from ~300ms (seq scan) to <10ms (index scan).

### 2. Stop the realtime stampede in `useCardStats`
- **Remove** the `transactions` INSERT subscription. The existing `refetchInterval: 10_000` already keeps the today-checkout count fresh enough for the operator dashboard, and dropping this subscription eliminates ~10 invalidations per batch distribution per client.
- Keep the `qr_cards` subscription but **debounce** it (e.g. coalesce events for 1.5s) so a burst of updates triggers one refetch, not many.

### 3. Reduce `useQRCards` pressure
- **Debounce** the `qr_cards` realtime subscription in `useQRCards` the same way (1.5s).
- This single hook is what makes Unblock / Stats / QR Generator screens slow down during heavy scanning, because each scan re-fetches all 2,255 rows on every open admin tab.

### 4. (Verify only — no code change) RPCs are already optimal
`activate_beneficiary_card`, `checkout_beneficiary_card`, `distribute_marketplace_item(s_batch)`, `return_marketplace_item(s_batch)` are all single-roundtrip SECURITY DEFINER functions using the `lower(unique_id)` index — those parts are fine.

## Technical notes
- Index creation on 306k rows is fast (seconds) and runs in the migration.
- The realtime debounce will be a small `useRef` timer in each hook; no behavior change for the user beyond ~1.5s extra delay before stats refresh after someone else's scan.
- No changes to RPCs, no changes to the scan UX, no changes to the auto-unblock cron.

## Out of scope
- Pagination of `useQRCards` consumers (Stats / Unblock screens) — bigger refactor; revisit if step 3 isn't enough.
- Compute instance upsize — only suggest if these fixes don't restore speed.
