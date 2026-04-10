

## Fix: Beneficiary Count Shows 16 Instead of 1,183 for She Thrives

### What Happened

When we reset the 1,161 stuck cards earlier, their `marketplace_id` was cleared (set to NULL). This was necessary to make the cards reusable for tomorrow's events. However, the "Beneficiaries" stat card counts cards currently linked to a marketplace (`qr_cards` + `archived_card_data`). Since almost all cards were unlinked, only the 16 still-active cards are counted.

The demographics section below correctly shows 1,183 because that data is stored separately in the `demographics_reach` field on the marketplace record.

### Fix

**Database fix**: Set `manual_beneficiary_count = 1183` for the She Thrives marketplace. This field already exists and the reports UI already prefers it when set (line 210 of MarketplaceReports.tsx).

```sql
UPDATE marketplace_events 
SET manual_beneficiary_count = 1183 
WHERE id = 'ff0d8005-7c85-4a8d-9e0c-147475e7b0eb';
```

**Code fix**: Update the single-marketplace detail view in `useMarketplaceAllocations.ts` to also prefer `manual_beneficiary_count` or `demographics_reach` over the card count for completed marketplaces. Currently only the reports list view does this — the detail view always uses `allBeneficiaries.length`.

### Changes

| Action | Type |
|---|---|
| Set `manual_beneficiary_count = 1183` for She Thrives | Database fix |
| Use `manual_beneficiary_count ?? demographics_reach` as beneficiary total for completed events in the detail view | Code fix in `useMarketplaceAllocations.ts` |

This ensures that completed marketplaces whose cards have been reset still show the correct historical beneficiary count.

