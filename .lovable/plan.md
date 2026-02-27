

## Auto-Allocate Surpluss Donations to Feb 28 She Thrives Marketplaces

### Overview
Create a one-time edge function that fetches all approved donations from the Surpluss API, ensures each has a matching `item_types` record, and creates `marketplace_item_allocations` entries for both Feb 28 She Thrives events, splitting quantities evenly between the two halves.

### Target Marketplaces
- **First Half**: `ff0d8005-7c85-4a8d-9e0c-147475e7b0eb` (ext_id 11)
- **Second Half**: `1e38fa11-da12-42d0-8e74-3ce9dd41f964` (ext_id 5)

### What the Edge Function Does

**File**: `supabase/functions/allocate-donations-to-marketplace/index.ts`

1. Calls the Surpluss donations API (production, all pages) to fetch every approved donation
2. For each donation:
   - Checks if an `item_types` record exists by `external_material_id`
   - If not, creates one with the donation title, category/subcategory from donation tags, and `total_stock` = `item_count`
   - If it exists, updates `total_stock` to the latest `item_count` value
3. Splits each item's `item_count` evenly across both marketplaces (first half gets ceiling, second half gets floor)
4. Inserts `marketplace_item_allocations` rows (skipping if one already exists for that marketplace + item combo)
5. Returns a summary of all allocations created

### Example Split
- Body Wash (318 pcs): First Half gets 159, Second Half gets 159
- Toys (1381 pcs): First Half gets 691, Second Half gets 690

### Items to be Allocated (from Surpluss API)
Recent approved donations include: Body Wash, Toys, Baby Accessories, Baby Clothes, Blankets, Pillow/Cushion Covers, Body Care, Hair Care, Skin Care, Home Decor, Storage Containers, Towels, and more across multiple pages.

### Technical Details
- Edge function uses service role key, `verify_jwt = false`
- Fetches all pages from Surpluss API (page 1..N, 50 per page)
- Uses `item_count` (piece count) as the allocation quantity, not `quantity` (kg weight)
- Respects the `total_stock` source-of-truth rule: updates stock from the donations API which is the approved source
- Config entry added to `supabase/config.toml`
- Function can be deleted after single use

### After Execution
- Both Feb 28 marketplaces will show all available items with their allocated quantities in the Allocation Management tab
- Distribution tracking will work normally during the event
