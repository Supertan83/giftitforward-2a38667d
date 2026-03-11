

# Fix Item Category Mismatches per Excel Mapping

## Mismatches Found (12 subcategory groups, ~43 items)

| Subcategory | Current Category | Correct Category | Count |
|---|---|---|---|
| Accessories (car care, sunshades...) | Clothing, Apparel & Accessories | **Miscellaneous** | 2 |
| Accessories (chargers, cables...) | Clothing, Apparel & Accessories | **Electronics & Appliances** | 1 |
| Accessories (Gift bags) | Clothing, Apparel & Accessories | **Miscellaneous** | 3 |
| Bathroom Accessories | Clothing, Apparel & Accessories | **Home Goods** | 2 |
| Children's Shoes | Baby & Kids | **Clothing, Apparel & Accessories** | 3 |
| Children's Slippers | Baby & Kids | **Clothing, Apparel & Accessories** | 5 |
| Household Accessories | Clothing, Apparel & Accessories | **Home Goods** | 10 |
| Kids Girl's Accessories | Baby & Kids | **Clothing, Apparel & Accessories** | 2 |
| Shoe Products & Accessories | Clothing, Apparel & Accessories | **Beauty, Hygiene & Personal Care** | 1 |
| Swimming Accessories | Clothing, Apparel & Accessories | **Toys, Sports & Stationery** | 4 |
| Toddlers Apparel (0-5) | Baby & Kids | **Clothing, Apparel & Accessories** | 7 |
| Toddlers Shoes | Baby & Kids | **Clothing, Apparel & Accessories** | 3 |

## Changes

### 1. Database — Fix existing items (via edge function per project convention)
Deploy and invoke a one-time edge function that runs 12 UPDATE statements to correct the categories above.

### 2. Sync function — Expand remapping to prevent regression
Update `sync-surpluss-allocations/index.ts` to add a **secondary remapping pass** that runs on ALL items (not just "Waste") to enforce the Excel mapping. This catches items where Surpluss sends incorrect tags:

- Add subcategory-to-category override map after the Waste remap block
- Covers all 12 mismatched subcategories plus adds "Miscellaneous" as a valid category
- Ensures future syncs maintain correct classifications

### Files
- **New**: `supabase/functions/fix-category-mismatches/index.ts` — one-time correction
- **Edit**: `supabase/functions/sync-surpluss-allocations/index.ts` — add subcategory override map

