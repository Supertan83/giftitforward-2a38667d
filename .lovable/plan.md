

# Fix: QR Card Remains Blocked After Admin Archive & Reset

## Problem

When an admin performs "Archive & Reset" on a marketplace, the QR card is correctly reset to `inactive` status. However, if the same card is then used again the same day (e.g., for a PM session) and checked out, it goes back to `checked_out` status. A second "Archive & Reset" fails to find and reset the card because it filters by `marketplace_id`, which may no longer match if the card was associated with a different marketplace or the query timing is off.

The core issue is in the activation logic (`useSupabaseData.ts`, line 189):

```text
if (card.status === 'checked_out') {
  throw new SafeError('This card has already been used today...');
```

This **unconditionally blocks** any `checked_out` card, even after an admin has explicitly archived and reset it. There is no way for an admin reset to "override" this same-day block.

## Root Cause (Two Parts)

1. **Activation guard is too strict**: It blocks ALL `checked_out` cards without checking whether an admin has already reset it. Since the reset sets `status: 'inactive'`, this only matters when the reset misses the card.

2. **Archive & Reset filter gap**: `archiveAndResetCards` only finds cards WHERE `marketplace_id = selectedMarketplace`. If a card was checked out and its marketplace_id was already cleared by a prior reset or unblock, the subsequent archive won't find it.

## Solution

### 1. Fix the `archiveAndResetCards` query to also capture `checked_out` cards

Currently it only looks for cards with `marketplace_id = X`. It should also capture any cards that were recently used at that marketplace but may have had their marketplace_id cleared. We'll broaden the query to include cards that are in `checked_out` or `active` status AND were activated today, in addition to the marketplace_id filter.

**File**: `src/hooks/useSupabaseData.ts` (archiveAndResetCards mutation, ~line 1574)

Change the query from:
```typescript
.eq('marketplace_id', marketplaceId)
```
To:
```typescript
.or(`marketplace_id.eq.${marketplaceId},and(status.eq.checked_out,marketplace_id.is.null)`)
```

This ensures cards that lost their marketplace association but are still in `checked_out` status get swept up in the reset.

### 2. Make activation respect admin resets

The activation guard should only block reuse if the card hasn't been explicitly reset. After a successful archive & reset, the card status is `inactive`, `marketplace_id` is null, and `activated_at` is null. If the card is still `checked_out`, it truly hasn't been reset yet.

No change needed to the activation guard itself -- the guard correctly blocks `checked_out` cards. The fix is ensuring the reset actually transitions the card to `inactive`.

### 3. Add a direct "force reset" for individual cards in the Sync panel

For edge cases where specific cards are stuck, add a per-card reset button in the MarketplaceSyncPanel that directly sets status to `inactive` regardless of current state -- similar to the existing `unblockCard` but accessible from the sync panel.

**File**: `src/components/admin/MarketplaceSyncPanel.tsx`

Add a column with a "Force Reset" button for any card that shows as stuck (status `checked_out` with no marketplace).

### 4. Fix the immediate stuck card

Run a data fix for `QR-ML95AOYR-NQPM` to set it back to `inactive`.

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useSupabaseData.ts` | Broaden `archiveAndResetCards` query to also capture orphaned `checked_out` cards; add a `forceResetCard` mutation |
| `src/components/admin/MarketplaceSyncPanel.tsx` | Add per-card "Force Reset" button for stuck cards |
| Database (data fix) | Reset `QR-ML95AOYR-NQPM` to inactive |

## Impact

- Cards will no longer get stuck in `checked_out` after admin archive & reset
- AM/PM same-day reuse will work correctly after admin intervention
- Archived marketplace data is still preserved before reset
- No changes to the normal volunteer flow or same-day reuse prevention for non-admin scenarios

