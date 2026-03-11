

# Reclassify "General Donations" Items Using Excel Mapping

## Problem
65+ items are stuck in "General Donations" because the previous Waste remapping fallback put them there. Each item already has a correct `subcategory` value that maps directly to a proper main category per the uploaded Excel sheet.

## Subcategory-to-Category Mapping (from Excel)

| Subcategory (in DB) | Correct Category |
|---|---|
| Art Supplies & Craft Materials | Toys, Sports & Stationery |
| Body Care (Soap, Shower Gel, Scrub) | Beauty, Hygiene & Personal Care |
| Books & Magazines | Toys, Sports & Stationery |
| Bottles | Kitchen & Dining |
| Containers | Kitchen & Dining |
| Cups & Mugs | Kitchen & Dining |
| Essential & Massage Oil | Beauty, Hygiene & Personal Care |
| Gift Box / Sets (Stanley, notepad, pen) | Home Goods |
| Glassware | Kitchen & Dining |
| Hair Care (Shampoo, Conditioner, Mask) | Beauty, Hygiene & Personal Care |
| Hard Baskets | Home Goods |
| Induction Stove | Electronics & Appliances |
| Iron & Steamers | Electronics & Appliances |
| Kettles | Electronics & Appliances |
| Laptops | Electronics & Appliances |
| Magazine holder | Toys, Sports & Stationery |
| Makeup | Beauty, Hygiene & Personal Care |
| Mirror | Home Goods |
| Notebooks | Toys, Sports & Stationery |
| Organizer | Home Goods |
| Paper products (tissue, napkins) | Home Goods |
| Plates & Bowls | Kitchen & Dining |
| Prayer Mat | Home Textile (soft goods) |
| Skin Care (creams, serums, moisturizers, face wash) | Beauty, Hygiene & Personal Care |
| Television (Smart LED) | Electronics & Appliances |
| Trays | Kitchen & Dining |
| Yoga Mats | Home Textile (soft goods) |

## Changes

### 1. Database migration — reclassify all 65+ "General Donations" items
Run UPDATE statements for each subcategory mapping above to set the correct `category`.

### 2. Update sync function remapping logic
Expand the regex-based Waste remapping in `sync-surpluss-allocations/index.ts` to cover subcategories that currently fall through to "General Donations":
- Add patterns for: books, magazine, notebook, stationery, craft, sewing → Toys, Sports & Stationery
- Add patterns for: bottle, container, cup, mug, glass, plate, bowl, tray → Kitchen & Dining
- Add patterns for: gift.set, basket, mirror, organiz, paper.product, tissue → Home Goods
- Add patterns for: prayer.mat, yoga → Home Textile (soft goods)
- Add patterns for: oil, massage → Beauty, Hygiene & Personal Care
- Add patterns for: kettle, laptop, television, tv, iron, steamer, induction → Electronics & Appliances

This ensures future syncs classify items correctly instead of falling back to "General Donations".

### Files to modify
- **Database** — SQL UPDATE statements (via insert tool) to fix existing data
- `supabase/functions/sync-surpluss-allocations/index.ts` — expand Waste remapping regex

