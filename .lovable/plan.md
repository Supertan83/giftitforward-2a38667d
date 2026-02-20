
# Fix: All 2,100 QR Cards Not Loading (Server-Side 1,000 Row Cap)

## Problem
Despite setting `.limit(5000)` in the query, the server still returns only 1,000 cards. The database has 2,100 cards across 4 batches, but only the newest 1,000 are visible (the Feb 19 batch). The Feb 18 batches (495 + 500 cards) and the legacy batch (105 cards) are hidden.

## Root Cause
The hosted database has a server-side maximum of 1,000 rows per request. The client-side `.limit(5000)` cannot override this server setting. The query returns exactly 1,000 rows silently.

## Solution
Modify the `useQRCards` hook to fetch cards in multiple pages of 1,000 using `.range()`, then combine all results. This ensures all cards are retrieved regardless of the server limit.

## Technical Details

### File: `src/hooks/useSupabaseData.ts` (useQRCards hook, lines 48-75)

Replace the single query with a paginated fetch loop:

```typescript
queryFn: async (): Promise<QRCard[]> => {
  const allData: any[] = [];
  const pageSize = 1000;
  let from = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('qr_cards')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw new SafeError(mapDatabaseError(error), error);
    if (!data || data.length === 0) break;
    
    allData.push(...data);
    if (data.length < pageSize) break; // last page
    from += pageSize;
  }

  return allData.map(card => ({
    // ... same mapping as before
  }));
}
```

This loops through pages of 1,000 until all records are fetched, combining them into a single array. No other files need changes -- the existing UI pagination and batch grouping will work with the full dataset.
