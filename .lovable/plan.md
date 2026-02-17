

## Manual Data Entry for CDA Events

### Overview
Add a new "Marketplace Data" editor section in the Marketplace Reports page, positioned between the summary stat cards and the Item Distribution section. This follows the same UX pattern as the existing "Beneficiary Demographics" Add Data button -- a card with view/edit modes that allows admins to manually enter post-event marketplace data.

### What Gets Built

#### 1. New Component: `MarketplaceManualDataEditor`

A card component (same style as `MarketplaceDemographicsEditor`) with:

**View Mode:**
- Header: "Marketplace Data" with the marketplace name, an "Add Data" / "Edit" button
- Summary: Total Beneficiaries (manual), Total Items Allocated, Total Items Distributed
- Item breakdown table matching the report format (grouped by category, showing Name / Allocated / Distributed / Remaining)

**Edit Mode (after clicking "Add Data"):**
- **Manual Beneficiary Count** input field (stored as a new column `manual_beneficiary_count` on `marketplace_events`)
- **Item rows**: Each existing allocation shows editable Allocated and Distributed fields
- **"Add Item" button**: A searchable dropdown of all `item_types` to add new allocation rows
- **Delete** button per row to remove an allocation
- Save/Cancel buttons

This directly writes to:
- `marketplace_events.manual_beneficiary_count` (new column) for the beneficiary count
- `marketplace_item_allocations` table for item-level data (using existing mutations)

#### 2. Database Migration

Add one new column to `marketplace_events`:

```
manual_beneficiary_count INTEGER DEFAULT NULL
```

This stores the CDA-provided beneficiary count separately from the live QR card count, so both can coexist. When this value is set, the report summary cards will display it instead of (or alongside) the QR-based count.

#### 3. Update Marketplace Reports to Use Manual Data

In `MarketplaceReports.tsx`:
- Insert the new `MarketplaceManualDataEditor` component after the Beneficiary Demographics section
- Update the top-level "Beneficiaries" stat card to show `manual_beneficiary_count` when available (with a label indicating it's manually entered)

#### 4. Report Data Integration

In `useMarketplaceAllocations.ts` (`useMarketplaceReport`):
- Include `manual_beneficiary_count` in the marketplace query
- Add it to the `MarketplaceReport` type so the report can display it

### Technical Details

**New file:** `src/components/admin/MarketplaceManualDataEditor.tsx`
- Props: `marketplaceId`, `marketplaceName`
- Uses `useMarketplaceAllocations(marketplaceId)` for item data
- Uses `useItemTypesExtended()` for the item dropdown
- Uses `useAllocationOperations()` for create/update/delete mutations
- Directly queries/updates `marketplace_events` for `manual_beneficiary_count`

**Modified files:**
- `src/components/admin/MarketplaceReports.tsx` -- add the new editor component
- `src/hooks/useMarketplaceAllocations.ts` -- include `manual_beneficiary_count` in report type and query
- Database migration -- add `manual_beneficiary_count` column

**Data flow for item entry:**
- Adding a new item: calls `allocateToMarketplace` mutation (creates `marketplace_item_allocations` row)
- Editing quantities: calls `updateAllocationQuantities` mutation (updates allocated + distributed)
- Deleting a row: calls `deleteAllocation` mutation
- All these mutations already exist and handle cache invalidation

**Component layout (edit mode):**

```text
+--------------------------------------------------+
| Marketplace Data                    [Cancel][Save]|
| Young Dreamers Boys Community School               |
+--------------------------------------------------+
| Manual Beneficiary Count: [_____]                  |
|                                                    |
| Item Allocations:                                  |
| +------+-------------+-----------+----------+----+ |
| | Item | Allocated   | Distributed          | X  | |
| +------+-------------+-----------+----------+----+ |
| | Shoe | [500]       | [320]               | X  | |
| | Bags | [200]       | [180]               | X  | |
| +------+-------------+-----------+----------+----+ |
| [+ Add Item]                                       |
+--------------------------------------------------+
```

