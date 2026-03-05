

# Fix Per-Marketplace Beneficiary Counts in Live Queue

## Problem
The per-marketplace breakdown in the Live Queue only uses `qr_cards.marketplace_id`, which is cleared at midnight by the auto-unblock job. So:
- "Young Dreamers Boys Community School Marketplace" (Feb 19) shows **0** because all cards were reset
- "She Thrives Women Workers" (Feb 28) still shows **1183** because cards haven't been reset yet
- Future completed events will also lose their counts

Additionally, the `activateCard` mutation doesn't include `marketplace_id` in the CheckIn transaction, making transaction-based historical queries impossible.

## Data Sources Available
- `qr_cards` — current card state, marketplace_id cleared at midnight reset
- `archived_card_data` — 42 records for Young Dreamers, 42 for Dry Run, 18 for Lea's — preserves marketplace_id after reset
- `transactions` — CheckIn/CheckOut have `marketplace_id = NULL` (bug)

## Plan

### 1. Fix CheckIn transaction to include marketplace_id
**File**: `src/hooks/useSupabaseData.ts`

In the `activateCard` mutation (line ~261), add `marketplace_id` to the CheckIn transaction insert so future data is queryable:
```ts
await supabase.from('transactions').insert({
  card_id: card.id,
  type: 'CheckIn',
  credit_change: 0,
  marketplace_id: marketplaceId || null  // ADD THIS
});
```

### 2. Add archived card data query to Admin Dashboard
**File**: `src/components/admin/AdminDashboard.tsx`

Add a query for `archived_card_data` grouped by marketplace_id to get historical beneficiary counts for events where cards have already been reset. This supplements the live qr_cards data.

### 3. Update queueStats to combine both sources
**File**: `src/components/admin/AdminDashboard.tsx`

Merge data from:
- **qr_cards** (current): cards still assigned to a marketplace (live/recent events)
- **archived_card_data** (historical): cards that were reset after completed events

For each marketplace, compute:
- **Activated**: count of unique cards (from both sources)
- **In Queue**: only from qr_cards where status = 'active' (only relevant for live events)
- **Checked Out**: from qr_cards (status = 'checked_out') + archived_card_data count
- **Total Served**: sum of in queue + checked out

Cross-reference with `marketplace_events` to show marketplace name, event date, and sort by date (most recent first). Only show marketplaces with activity.

### 4. Update StatsDashboardZone similarly
**File**: `src/components/zones/StatsDashboardZone.tsx`

Apply the same archived data merge so the employee stats dashboard also shows accurate historical per-marketplace counts.

## Files Changed
1. `src/hooks/useSupabaseData.ts` — Fix CheckIn transaction to include marketplace_id
2. `src/components/admin/AdminDashboard.tsx` — Query archived_card_data, merge into per-marketplace breakdown
3. `src/components/zones/StatsDashboardZone.tsx` — Same archived data merge for employee view

