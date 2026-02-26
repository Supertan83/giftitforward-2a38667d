

## Fix: Sync Donations Request Too Large

### Problem
The "Sync Donations" button fetches all ~400+ donations from the Surpluss API, then sends them ALL in a single request to `sync-surpluss-allocations`. The JSON payload is enormous (each donation includes full company info, images, material groups, etc.), causing the request to fail with "Failed to fetch" (request body too large / timeout).

### Solution
Split the sync into batches of 25 donations per request to `sync-surpluss-allocations`, instead of sending everything at once.

### Changes

**File: `src/components/admin/SurplussSyncMonitor.tsx`**

Modify `handleSyncDonations` to:
1. Keep the existing fetch-all-donations pagination logic (this works fine -- 50 per page from the API)
2. After collecting all donations, split them into chunks of 25
3. Call `sync-surpluss-allocations` once per chunk, sequentially
4. Accumulate the summary totals (created, updated, failed) across all batches
5. Show a single toast at the end with combined totals

### Technical Detail

```text
// Instead of:
await supabase.functions.invoke('sync-surpluss-allocations', {
  body: { allocations: allDonations, environment }  // 400+ items = too large
});

// Batch into chunks of 25:
for (const chunk of chunks) {
  await supabase.functions.invoke('sync-surpluss-allocations', {
    body: { allocations: chunk, environment }  // 25 items per call
  });
}
```
