

# Fix Orphaned Cards and Preserve Marketplace Link on Checkout

## Problem
When a beneficiary is checked out at the Exit Zone, the checkout logic clears the card's `marketplace_id`. This breaks the distribution count RPC (`get_marketplace_distribution_count`), which joins `transactions` with `qr_cards` using `marketplace_id` to count items. Result: 79 distributions from 7 cards are missing from today's total.

## Part 1: Data Fix (Immediate)
Re-link the 7 orphaned cards back to the Young Dreamers marketplace so their 79 transactions are counted again.

**SQL update** (via migration or data update):
```sql
UPDATE qr_cards
SET marketplace_id = '49fb6332-2eb5-417d-a076-d3a66af20ba9'
WHERE status = 'checked_out'
  AND marketplace_id IS NULL
  AND id IN (
    SELECT DISTINCT card_id FROM transactions
    WHERE timestamp::date = CURRENT_DATE
  );
```

Also fix the 3 active cards with NULL marketplace_id:
```sql
UPDATE qr_cards
SET marketplace_id = '49fb6332-2eb5-417d-a076-d3a66af20ba9'
WHERE status = 'active'
  AND marketplace_id IS NULL
  AND activated_at::date = CURRENT_DATE;
```

## Part 2: Code Fix (Prevent Future Orphaning)

### Change 1: `checkoutCard` mutation in `useSupabaseData.ts` (line ~410-418)
Stop clearing `marketplace_id` on checkout. The update should only change `status` to `checked_out` and reset balance/items, but **keep** `marketplace_id` and `activated_at` intact.

**Before:**
```typescript
.update({
  status: 'checked_out',
  credit_balance: 0,
  total_items_collected: 0,
  collected_items: []
})
```

This already does NOT clear `marketplace_id` -- good. The issue is that after checkout, cards with `checked_out` status still have their `marketplace_id` preserved. The real problem is elsewhere.

Wait -- re-reading the checkout code: it sets `status: 'checked_out'` but does NOT set `marketplace_id: null`. So the checkout itself is fine. The orphaning must come from the **unblock** step that happens after checkout.

Looking more carefully: the 7 cards have `status = 'checked_out'` AND `marketplace_id = NULL`. This means something else cleared the marketplace_id after checkout. The `unblockCard` mutation and `auto-unblock-cards` edge function both set `marketplace_id: null`, but those only target cards from previous days or explicitly unblocked cards.

The most likely cause: the `archiveAndResetCards` function catches orphaned `checked_out` cards with `marketplace_id IS NULL` and resets them. But first something must have cleared the marketplace_id on these 7 cards.

Actually, looking at the data again: these 7 cards were checked out today and currently have `marketplace_id = NULL`. The checkout code does NOT clear it. So either:
1. A manual force-reset was done on them
2. Or a bulk unblock hit them

Regardless of root cause, the fix should be:

### Approach: Update the RPC to be resilient

Instead of relying on `qr_cards.marketplace_id` (which gets cleared), store the `marketplace_id` directly on the **transaction** itself. This way the count is always accurate regardless of card state.

However, that's a larger change. A simpler and more targeted fix:

### Simpler Approach: Preserve `marketplace_id` on checkout

**File: `src/hooks/useSupabaseData.ts`**

The `checkoutCard` mutation (lines 398-433) already preserves `marketplace_id`. No change needed there.

The actual fix needed: ensure cards checked out today are NOT caught by the `auto-unblock-cards` edge function or `bulkUnblockPreviousDays` before the day ends.

But since the 7 cards already lost their `marketplace_id`, the simplest complete fix is:

1. **Data fix**: Re-link the 7 orphaned cards now
2. **Preventive fix**: In the `checkoutCard` mutation, explicitly re-set `marketplace_id` to the card's current value (no-op but defensive)
3. **Archive fix**: In the `archiveAndResetCards` function, before resetting orphaned cards, assign them to the selected marketplace so archived data is correct

---

## Final Plan

### Step 1: Database Data Fix
Run an UPDATE to re-link all orphaned checked-out cards from today to the Young Dreamers marketplace (`49fb6332-2eb5-417d-a076-d3a66af20ba9`).

### Step 2: Fix `archiveAndResetCards` in `useSupabaseData.ts`
When archiving orphaned cards (`status = checked_out, marketplace_id IS NULL`), the function already assigns `marketplace_id || marketplaceId` in the archive data. This is correct. No change needed.

### Step 3: Investigate and fix the bulk unblock
The `bulkUnblockPreviousDays` mutation (line ~495) likely uses the `auto-unblock-cards` edge function which clears `marketplace_id`. Check if it accidentally hits same-day cards.

Looking at the edge function: it filters by `activated_at < todayISOString`. Since today's cards have `activated_at` set to today, they should NOT be caught. But if `activated_at` was cleared by something else first, and the card was then manually unblocked...

### Root Cause Conclusion
The 7 cards likely had their `marketplace_id` cleared by an individual `unblockCard` call or `forceResetCard` call done manually by a volunteer/admin. The fix is:

### Final Steps:

1. **Data fix** -- Update the 7 orphaned cards to re-link to Young Dreamers marketplace
2. **Code fix** -- Modify `checkoutCard` to explicitly preserve `marketplace_id` in the update (defensive)  
3. **Code fix** -- Add a `marketplace_id` column to the `transactions` table so distribution counts never depend on the card's current state

Actually, adding a column is the most robust fix but is a bigger change. Let me keep it simpler:

### Simplified Final Plan:

1. **Data fix**: SQL update to re-link 7 orphaned cards to Young Dreamers marketplace
2. **Code fix in `checkoutCard`**: No change needed (already preserves marketplace_id)  
3. **Code fix in `unblockCard`**: This is the culprit -- it sets `marketplace_id: null`. Change it so it only runs on cards from **previous days**, not same-day cards. Or better: only the `auto-unblock-cards` cron and `archiveAndResetCards` should clear `marketplace_id`, not individual unblock actions during the same day.

---

## Concrete Changes

### 1. Data Fix (SQL)
Re-link orphaned cards from today to the Young Dreamers marketplace.

### 2. Code: `src/hooks/useSupabaseData.ts` -- `unblockCard` mutation (~line 436-470)
Add a guard: if the card was activated today, do NOT clear `marketplace_id`. Only clear it for cards from previous days. This prevents same-day unblock operations from breaking the transaction count.

### 3. Code: `src/hooks/useSupabaseData.ts` -- `forceResetCard` mutation (~line 1642-1666)  
Same guard: preserve `marketplace_id` for same-day cards, or at minimum log/archive before clearing.

### 4. Edge function: `auto-unblock-cards/index.ts`
Already correctly filters by `activated_at < today`. No change needed.

### Technical Details

**`unblockCard` change (lines 451-461):**
```typescript
// Determine if card is from today
const today = new Date();
today.setHours(0, 0, 0, 0);
const isFromToday = card.activated_at && new Date(card.activated_at) >= today;

const { error: updateError } = await supabase
  .from('qr_cards')
  .update({
    status: 'inactive',
    credit_balance: 0,
    total_items_collected: 0,
    collected_items: [],
    // Preserve marketplace_id for today's cards so transaction counts remain accurate
    marketplace_id: isFromToday ? card.marketplace_id : null,
    activated_at: isFromToday ? card.activated_at : null
  })
  .eq('id', card.id);
```

**`forceResetCard` change (lines 1642-1666):**
Fetch the card first to check `activated_at`, then apply the same logic.

