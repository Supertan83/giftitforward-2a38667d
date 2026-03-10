

# Fix "Waste" Category in Item List

## Problem
251 items in the `item_types` table have `category = 'Waste'` — a label that came from the Surpluss API's `donation_tag` field during past syncs. Surpluss says "Waste" is not a valid category on their platform. These items already have meaningful `subcategory` values (e.g., "Toddlers Apparel", "Towels", "Bags & Purses") that indicate their actual type.

The sync function (line 285) does update `category` on each run, so either:
- Surpluss still returns `donation_tag: "Waste"` for these items
- These items no longer appear in the API response and never get re-categorized

## Proposed Fix

### 1. One-time database migration to reclassify "Waste" items
Run a migration that maps "Waste" items to proper categories based on their existing `subcategory` values. The mapping:

| Subcategory pattern | New Category |
|---|---|
| Toddlers, Baby, Children, Diapers | Baby & Kids |
| Apparel, Shoes, Slippers, Bags, Accessories, Clothing | Clothing, Apparel & Accessories |
| Towels, Bedding, Curtains, Cushion, Pillow, Blanket, Duvet | Home Textile (soft goods) |
| Kitchenware, Cutlery, Cookware, Dinnerware | Kitchen & Dining |
| Household, Décor, Vases, Candles, Frames | Home Goods |
| Cosmetics, Skincare, Personal Care, Perfume, Hygiene | Beauty, Hygiene & Personal Care |
| Electronics, Appliances | Electronics & Appliances |
| Toys, Sports, Stationery, School, Games | Toys, Sports & Stationery |
| Everything else | General Donations |

### 2. Update sync function to handle "Waste" tag
Add a mapping in `sync-surpluss-allocations/index.ts` so that if the Surpluss API returns `donation_tag = "Waste"`, the sync remaps it to a proper category using the same subcategory-based logic. This prevents future syncs from overwriting the corrected categories back to "Waste".

### Files to modify
- **Database migration** — SQL UPDATE statements to reclassify existing items
- `supabase/functions/sync-surpluss-allocations/index.ts` — add category remapping when `donation_tag` is "Waste"

