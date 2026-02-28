

# Fix: Beneficiary Count Capped at 1000 in Marketplace Report

## Problem
The "All Marketplaces Overview" correctly shows 1182 beneficiaries because it uses `count: 'exact', head: true` (a counting query with no row limit). However, the individual marketplace report fetches actual rows via `.select('*')`, which is capped at 1000 rows by the database default limit. The total is then derived from `allBeneficiaries.length`, so it shows 1000 instead of 1182.

## Solution
Apply paginated fetching for both `archived_card_data` and `qr_cards` inside `useMarketplaceReport`, using the same `.range()` pattern already used elsewhere in the codebase for the 2100+ QR cards dataset.

## Changes

**File: `src/hooks/useMarketplaceAllocations.ts`**

1. Add a small paginated-fetch helper (reusable within the file):
```text
async function fetchAllRows(table, filters) {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data } = await supabase
      .from(table).select('*')
      .eq(filters.col, filters.val)
      .range(from, from + PAGE - 1);
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
```

2. Replace the two single-shot `.select('*')` calls for `archived_card_data` and `qr_cards` (lines 381-389) with calls to this helper, so all rows beyond 1000 are fetched.

3. No other changes needed -- the downstream demographics logic already iterates `allBeneficiaries`, so once the array is complete the counts and breakdowns will be correct automatically.

## Why not just use `count: 'exact'`?
The report also computes demographic breakdowns (gender, nationality, marital status, children count) from the actual row data. A count-only query would fix the total but break the demographic analysis. Paginated fetching solves both.

## Impact
- Individual marketplace report will show the correct 1182 (or whatever the real total is)
- Demographic breakdowns will include all beneficiaries, not just the first 1000
- Overview cards remain unaffected (already correct)
- No database or schema changes needed

