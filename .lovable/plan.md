

## Add "Sync Donations" Button to Sync Monitor

### Problem
The Sync Monitor page only has "Sync All Now" (which calls `sync-surpluss-event-allocations` for marketplace allocations). There is no way to trigger `sync-surpluss-allocations` (the donations sync that sets correct `total_stock` values) from this page.

The donations sync currently only exists in the `SurplussSyncPanel` component, which is a different admin section.

### Solution
Add a "Sync Donations (Fix Stock Totals)" button to the Sync Monitor, right next to "Sync All Now" and "Fetch All Marketplaces from Surpluss".

### How It Will Work
1. The button will first call `fetch-surpluss-allocations` to pull all donations from the Surpluss API
2. Then pass those donations to `sync-surpluss-allocations` which updates `total_stock` in `item_types` with the correct quantities from the Surpluss database
3. A toast notification will show how many items were created/updated
4. This is the same flow already used in `SurplussSyncPanel.tsx` -- just exposed in the Sync Monitor

### Changes

**File: `src/components/admin/SurplussSyncMonitor.tsx`**

- Add a new `handleSyncDonations` function that:
  1. Calls `fetch-surpluss-allocations` with the current environment, paginating through all results
  2. Passes the fetched donations to `sync-surpluss-allocations`
  3. Shows success/failure toast with counts (created, updated, failed)
- Add a new button "Sync Donations" in the action bar (lines 425-434), next to the existing buttons
- Add `isSyncingDonations` state for loading indicator
- Use the `Package` icon (already imported) to visually distinguish it from the allocation sync

### UI Layout (after change)

```text
[Sync All Now]  [Fetch All Marketplaces]  [Sync Donations]
```

The "Sync Donations" button will be styled as an outline button with a Package icon, making it easy to find and clearly different from the allocation sync.

### After Deploying
Click the new "Sync Donations" button in the Sync Monitor. It will pull the correct `quantity` values from the Surpluss donations API and fix `total_stock` for all 23 affected items.
