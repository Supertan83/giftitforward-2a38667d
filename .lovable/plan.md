
User reports:
1. Autosync didn't work this morning → marketplace items weren't visible to volunteers initially
2. Manually synced now → items appeared with correct allocations
3. BUT distributed counts are too low because volunteers were distributing all morning while sync was broken

Wait — the issue is more subtle. Let me think:
- `qr_cards.total_items_collected` and `transactions` table track every actual distribution scan made by volunteers. These are the source of truth and would NOT have been affected by the Surpluss sync issue.
- `marketplace_item_allocations.distributed_quantity` is incremented by `distribute_marketplace_item` RPC when a volunteer scans. This also would have been incremented correctly regardless of sync.
- The Surpluss sync only affects `allocated_quantity` (what was supposed to be available) — not `distributed_quantity`.

So why is the distributed count low? Possibilities:
A. The allocation rows didn't exist this morning (sync failed), so `distribute_marketplace_item` had no row to increment → distribution scans went through (qr_cards updated) but `marketplace_item_allocations.distributed_quantity` stayed 0 because the row didn't exist yet.
B. Now allocations exist (after manual sync), but historical distributions aren't reflected on them.

Looking at the RPC:
```sql
SELECT * INTO v_alloc FROM marketplace_item_allocations
WHERE marketplace_id = p_marketplace_id
ORDER BY created_at ASC LIMIT 1;
IF FOUND THEN UPDATE ... SET distributed_quantity = distributed_quantity + 1
```
It picks the FIRST allocation row and increments it. If no rows existed → silently skipped. That's the bug they hit.

The truth lives in `transactions` table (every Distribution scan with marketplace_id). I need to:
1. Count actual Distribution transactions today for Taxi Drivers Morning marketplace
2. Compare to current `distributed_quantity` sum across allocations
3. Backfill the difference onto the (now-existing) allocation rows

Since allocations are at material level and transactions don't store which specific item was distributed (just type='Distribution', item_type='Item'), I can't perfectly redistribute the totals across specific materials. The best I can do: dump the entire missing total onto the first allocation row (matching how the RPC works), OR distribute proportionally.

Actually simpler — looking at how reports likely read it: total distributed = SUM(distributed_quantity) across allocations for that marketplace. So just need to make the SUM match the real transaction count.

## Plan

1. **Investigate (read-only)**: 
   - Get total Distribution transactions for today's Taxi Drivers Morning marketplace (truth)
   - Get current SUM(distributed_quantity) on its allocations (what's reported)
   - Get the gap

2. **Backfill**: Add the missing count onto the first allocation row of that marketplace (matches RPC behavior). This restores the reported total to match reality.

3. **Confirm to admin** with before/after numbers.

4. **Same check for the Afternoon event** since autosync was broken this morning — afternoon may also be affected if it ran with no allocations.

5. **Note about preventing recurrence**: The root cause is `distribute_marketplace_item` silently doing nothing if no allocation row exists. A future fix would be to log/alert on this. But for now, just data repair.

No code changes needed for the repair — pure data update via migration.
