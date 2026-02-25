

# Fix: Ensure All Beneficiary QR Cards Work at Marketplaces + Remove All Hardcoded Credit Limits

## Problem 1: QR Cards Not Working at Marketplaces

The activation logic in `useSupabaseData.ts` (line 215-222) blocks cards that are `checked_out` with the message "This card has already been used today." However, the `auto-unblock-cards` edge function and `bulkUnblockPreviousDays` only reset cards from **previous days**. If a card was checked out at a prior event and never unblocked, it remains in `checked_out` status, making it unusable at the next marketplace.

Additionally, the RPC functions (`distribute_marketplace_item`, `return_marketplace_item`) throw "Card not found" if the card exists but the `ilike` query doesn't match due to encoding or whitespace differences in scanned QR data (leading/trailing whitespace).

### Fixes

**File: `src/hooks/useSupabaseData.ts` (activateCard mutation, ~line 190-260)**
- When a card is `checked_out`, instead of blocking it, automatically reset it (set to `inactive` first) and then activate it. This way, any printed/registered QR card will always work regardless of its prior state.
- Add `.trim()` to the scanned `uniqueId` before querying, to handle whitespace in QR scans.

**File: `src/hooks/useSupabaseData.ts` (findCardByUniqueId, ~line 171)**
- Add `.trim()` to the uniqueId parameter.

**Database RPCs: `distribute_marketplace_item`, `distribute_marketplace_items_batch`, `return_marketplace_item`, `return_marketplace_items_batch`**
- Add `TRIM()` to the `p_unique_id` parameter before the `ilike` comparison, to handle any whitespace in scanned data.

---

## Problem 2: Hardcoded Credit Limit of 15

Multiple locations still use `15` as a hardcoded fallback or display value instead of reading from marketplace data. Every one of these must be changed.

### Locations and Fixes

| File | Line(s) | Current | Fix |
|------|---------|---------|-----|
| `src/components/CardStatusDisplay.tsx` | 19, 54 | `creditBalance / 15`, `{card.creditBalance}/15` | Accept `creditLimit` prop, use it instead of 15 |
| `src/components/zones/StatsDashboardZone.tsx` | 66 | `15 - (c.creditBalance \|\| 0)` | Look up each card's marketplace credit limit from the marketplaces array |
| `src/store/useAppStore.ts` | 70, 97, 130, 167, 176, 212 | Multiple hardcoded `15` references | Replace with configurable limit (the store is mainly for mock/demo mode, but should still be consistent) |
| `src/hooks/useSupabaseData.ts` | 279 | `let creditLimitValue = 15` (fallback in old `distributeItem`) | Already fetches from DB -- just the fallback value; keep as-is since the DB RPCs are the actual path used |
| Database RPCs | `v_limit := 15` fallback | When marketplace not found | This fallback is acceptable as a safety net since the marketplace should always exist |

### Detailed Changes

**File: `src/components/CardStatusDisplay.tsx`**
- Add `creditLimit?: number` prop (default 15 for backward compatibility)
- Line 19: `(card.creditBalance / (creditLimit || 15)) * 100`
- Line 54: `{card.creditBalance}/{creditLimit || 15}`

**File: `src/components/zones/EntranceZone.tsx`**
- Pass `creditLimit` to `CardStatusDisplay` when rendering the last activated card

**File: `src/components/zones/StatsDashboardZone.tsx`**
- Line 66: Instead of hardcoded `15`, look up each card's marketplace credit limit:
  - Build a map of marketplace ID to credit limit from the `marketplaces` array
  - For each card, use `marketplaceLimitMap[card.marketplaceId] || 15`

**File: `src/store/useAppStore.ts`**
- This is the mock/demo data store. Update the hardcoded `15` values to use a configurable constant or read from marketplace context. At minimum, define `const DEFAULT_CREDIT_LIMIT = 15` at the top and use it consistently, making it clear this is a fallback value.

---

## Summary of All Changes

| File | Type | Description |
|------|------|-------------|
| `src/hooks/useSupabaseData.ts` | Bug fix | Auto-reset `checked_out` cards on activation instead of blocking; add `.trim()` to scanned IDs |
| `src/components/CardStatusDisplay.tsx` | Remove hardcode | Accept and use dynamic `creditLimit` prop |
| `src/components/zones/EntranceZone.tsx` | Pass prop | Pass `creditLimit` to `CardStatusDisplay` |
| `src/components/zones/StatsDashboardZone.tsx` | Remove hardcode | Use per-marketplace credit limits for stats calculations |
| `src/store/useAppStore.ts` | Remove hardcode | Use `DEFAULT_CREDIT_LIMIT` constant instead of scattered `15` values |
| Database migration | Bug fix | Add `TRIM()` to all 4 distribution/return RPCs for the `p_unique_id` parameter |

