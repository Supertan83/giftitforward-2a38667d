# Item List → Mini Inventory (Grouped by Donor Company)

Convert the existing **Item List** screen into an operational inventory view so Ops can quickly identify which **Material IDs still have remaining stock** to consolidate against her Excel list. All underlying data already exists — only the presentation layer changes.

## Goal

Give Ops a single screen that answers: *"For each donor company, which materials are still sitting with remaining stock, and where were they assigned/distributed?"*

## New layout

Replace the current **Category-grouped** accordion with a **Donor Company-grouped** accordion.

```text
┌─ Centrepoint  (12 items • Total Remaining: 8,420) ──────────────┐
│ MATERIAL ID │ ITEM NAME       │ MARKETPLACE(S)     │ ASSIGNED │ DISTRIBUTED │ REMAINING │
│  10234      │ Baby Accessories│ —                  │   —      │   —         │  2,404    │
│  10456      │ Toys            │ Single Mothers …   │ 2,000    │ 1,500       │    500    │
│  …                                                                                       │
└────────────────────────────────────────────────────────────────────────────────────────┘

┌─ L'Occitane En Provence  (8 items • Total Remaining: 6,424) ────┐
│ …                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Group header shows
- Donor company name
- Item count
- **Total Remaining** across all that company's materials (highlighted)
- Collapse/expand toggle

### Row columns (per material)
1. **Material ID** (external_material_id) — bold/monospace, easy to cross-reference Excel
2. **Item Name** + subcategory below
3. **Category** (small muted)
4. **Marketplace(s)** — comma list of all marketplaces it's allocated to
5. **Assigned** (allocated_to_marketplace)
6. **Distributed** (distributed)
7. **Remaining** (totalStock − distributed) — bold primary color

### Filters & controls (top bar)
- Search (existing) — by name, material ID, donor, marketplace
- **"Only show items with remaining > 0"** toggle (default ON) — directly addresses Ops' use case
- Sort within group: by Remaining desc (default) so high-stock materials surface first
- Sort groups: by Total Remaining desc (default), or alphabetical

### Item detail dialog
Keep existing dialog (QR + Surpluss link) — no changes.

## Data

No backend changes. `useItemTypesExtended` already returns:
- `externalMaterialId`, `donorCompany`, `marketplaceNames`
- `totalStock`, `distributed`, `allocatedToMarketplace`

Items without a donor company go into an **"Unassigned Donor"** group at the bottom.

## Files to change

- `src/components/admin/ItemListViewer.tsx` — rework grouping logic (company instead of category), add Material ID column, add "remaining > 0" filter toggle, update header totals.

No changes to hooks, DB, or other components.

## Out of scope
- Export to Excel (can be added later if needed)
- Editing stock from this screen
- Changing the Item Detail dialog
