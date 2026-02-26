

## Fix: Inventory Total Stock Incorrectly Set to Allocation Amount (All Items)

### Problem

23 items currently have their `total_stock` set to exactly the sum of their marketplace allocations instead of the actual inventory total from Surpluss. This means the "remaining" balance shown in the app is wrong for all of them -- not just Kids Boys Perfume.

**Example**: Kids Boys Perfume has `total_stock = 730` (the allocation), but the real total is 2,000. So remaining shows ~700 instead of 1,270.

### Root Cause

Three code paths set `total_stock` to the allocation amount instead of the actual total:

1. **`sync-surpluss-event-allocations`** (line 172): When creating a new item during event sync, sets `total_stock: allocatedAmount`
2. **`webhook-receiver`** (line 2623): When creating items from webhook data, sets `total_stock: amount` (the allocation amount)
3. **`sync-surpluss-allocations`** (lines 266-293): This one correctly uses `donation.quantity` from the Surpluss donations API -- this is the **only correct source** of total stock

### Fix Strategy

The event-allocation sync and webhook should **never write total_stock** because they only know allocation amounts, not true totals. Only `sync-surpluss-allocations` (which queries the donations API directly) should set `total_stock`.

### Changes

**File 1: `supabase/functions/sync-surpluss-event-allocations/index.ts`**

- Line 172: Change `total_stock: allocatedAmount` to `total_stock: 0` for new items (safe default -- the donations sync will fill in the real number)
- Add a log warning when creating items without a known total

**File 2: `supabase/functions/webhook-receiver/index.ts`**

- Line 2623: Change `total_stock: amount` to `total_stock: 0` for the same reason

**File 3: Data correction -- trigger a donations sync**

- After deploying the code fixes, invoke the `sync-surpluss-allocations` function which will pull the correct `quantity` values from the Surpluss donations API and update `total_stock` for all 23 affected items to their true totals

### Technical Details

```text
// sync-surpluss-event-allocations/index.ts, line 172
// BEFORE (bug):
total_stock: allocatedAmount,

// AFTER (fix):
total_stock: 0,  // Will be populated by sync-surpluss-allocations from donations API
```

```text
// webhook-receiver/index.ts, line 2623
// BEFORE (bug):
total_stock: amount // Set initial stock to allocated amount

// AFTER (fix):
total_stock: 0  // Will be populated by donations sync
```

### Affected Items (23 total, examples)

| Item | Current total_stock (wrong) | 
|------|---------------------------|
| Kids Boys Perfume | 730 |
| Makeup and Cosmetics | 1,200 |
| Women clothing | 11,610 |
| Women's Clothes | 2,426 |
| Toys | 1,600 |
| Stationery | 900 |
| Women's shoes | 1,354 |
| ...and 16 more |

### Verification

1. Deploy both edge function fixes
2. Run `sync-surpluss-allocations` to pull correct totals from the Surpluss donations API
3. Verify Kids Boys Perfume now shows `total_stock = 2000` (or whatever the true Surpluss total is)
4. Check the Allocation Management UI shows correct remaining balances for all items

