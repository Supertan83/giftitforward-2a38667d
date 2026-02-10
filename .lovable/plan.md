

## Sort Marketplace Dropdown by Nearest Start Date

### What Changes
In the **Item Allocation** page (`AllocationManagement.tsx`), the marketplace dropdown will be sorted so that marketplaces with the nearest upcoming `event_date` appear first. Marketplaces without a date will appear at the bottom.

### Technical Details

**File: `src/components/admin/AllocationManagement.tsx`**

- Modify the `activeMarketplaces` variable (line 106) to sort by `event_date` ascending, with `null` dates pushed to the end
- Update the `SelectItem` rendering to also display the event date next to each marketplace name for easier identification

The sorting logic will:
1. Place marketplaces with dates before those without dates
2. Among dated marketplaces, sort by nearest date first (ascending)
3. Marketplaces without dates go to the bottom

