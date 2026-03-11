

# Fix "Children's Apparel" Category Mismatch

## Problem
12 items with subcategory **"Children's Apparel"** are still under **"Baby & Kids"** instead of **"Clothing, Apparel & Accessories"**. This subcategory was missed in the previous fix — only "Children's Shoes", "Children's Slippers", "Toddlers Apparel", etc. were covered.

## Items affected (12)
Boys Clothes, Boys clothing, Girls Clothing, Girls kids clothing, Kids Boy, Kids boys clothing, Kids clothes - boys (x2), Kids clothes - girls (x2), Kids clothing, Kids Girl

## Changes

### 1. `supabase/functions/fix-category-mismatches/index.ts`
Add `"Children's Apparel"` to the fixes array (line 22):
```typescript
{ subcategoryPattern: "Children's Apparel", correctCategory: 'Clothing, Apparel & Accessories' },
```

### 2. `supabase/functions/sync-surpluss-allocations/index.ts`
Add regex to the `subcategoryOverrides` array (line 286):
```typescript
[/children'?s\s*apparel/i, 'Clothing, Apparel & Accessories'],
```

### 3. Deploy & invoke the fix function
Run `fix-category-mismatches` to correct the 12 existing items in the database.

