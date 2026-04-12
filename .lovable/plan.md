

## Fix Morning Event Stats Showing Zero

### Problem
After recycling cards for the afternoon event, the Stats Dashboard shows all zeros for the morning event because it only counts live `qr_cards` filtered by `marketplace_id`. All cards were unlinked during recycling, and the component never reads `manual_beneficiary_count` or `archived_card_data`.

### Data Fix
**Set morning event status to `completed`** (it's still `active` in the database despite our earlier update):
```sql
UPDATE marketplace_events SET status = 'completed', status_locked_by_admin = true
WHERE id = '6ed111b0-f003-46e8-a719-d76cc1800431';
```

### Code Changes

**File: `src/components/zones/StatsDashboardZone.tsx`**

Update the beneficiary stats calculation to use a fallback hierarchy when a specific marketplace is selected:

1. **Fetch marketplace metadata** — the component already has `selectedMarketplace` from the `useMarketplaces()` hook, which includes `manual_beneficiary_count` and `demographics_reach`.

2. **Add archived card data query** — add a new query using `useQuery` to fetch `archived_card_data` for the selected marketplace when live card count is 0.

3. **Fallback logic for beneficiary count**:
   - If live cards exist for this marketplace → use them (current behavior)
   - Else if `manual_beneficiary_count` is set → use that as "Total Served"
   - Else if `archived_card_data` exists → count those records

4. **Fallback for demographics** (gender, children):
   - If live cards have data → use them
   - Else if `archived_card_data` exists → compute gender/children from archived records

5. **Items Distributed / Credits Used** — these already come from `marketplace_item_allocations` which were NOT reset, so they correctly show 19,896. No change needed.

6. **Activated Today / In Queue / Checked Out** — for completed events with no live cards, show 0 for "In Queue" and "Activated Today", but show `manual_beneficiary_count` for "Checked Out (Exit)" and "Total Served" since all beneficiaries were processed.

### Technical Details

The `MarketplaceEvent` type from `useMarketplaces()` already returns `manual_beneficiary_count` and `demographics_reach`. We just need to access `selectedMarketplace?.manual_beneficiary_count` in the `beneficiaryStats` computation.

For archived demographics, add a small query:
```typescript
const { data: archivedCards = [] } = useQuery({
  queryKey: ['archived_card_data', selectedMarketplaceId],
  queryFn: async () => {
    if (selectedMarketplaceId === 'all') return [];
    const { data } = await supabase
      .from('archived_card_data')
      .select('gender, children_count')
      .eq('marketplace_id', selectedMarketplaceId);
    return data || [];
  },
  enabled: selectedMarketplaceId !== 'all',
});
```

Then in `beneficiaryStats` memo, when `allProcessedCards.length === 0`:
- Use `selectedMarketplace?.manual_beneficiary_count ?? archivedCards.length` for total
- Use archived cards for gender/children breakdowns if available
- Show the manual count for "Checked Out" and "Total Served"

### Result
- Morning event will show 1,082 beneficiaries (from `manual_beneficiary_count`)
- Items Distributed and Credits Used already show 19,896 correctly
- Afternoon event continues working with live card data
- Future recycled events will also display correctly

