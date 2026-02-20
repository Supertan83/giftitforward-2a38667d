

# Fix: Distributed Quantity Resets to 0 After Manual Edit

## Problem
When an admin manually edits the "Distributed" quantity for an item allocation (e.g., setting "Boys Clothing" to 300), the save succeeds but the value reverts to 0 shortly after. 

## Root Cause
The `sync-surpluss-event-allocations` edge function runs periodically (via cron) and overwrites **both** `allocated_quantity` and `distributed_quantity` with whatever the Surpluss API returns. Since the Surpluss API typically reports `distributed_amount: 0` for these CDA/manual events, every sync cycle resets the manually entered distributed values back to 0.

The problematic code is in `supabase/functions/sync-surpluss-event-allocations/index.ts`, line 200-201:

```text
await supabase.from('marketplace_item_allocations')
  .update({ allocated_quantity: allocatedAmount, distributed_quantity: distributedAmount, ... })
  .eq('id', existingAlloc.id);
```

## Solution
Modify the `syncMaterial` function to **preserve the higher value** of `distributed_quantity`. If the existing database value is greater than what the API reports, keep the existing value. This ensures:
- Manual edits by admins are preserved
- If Surpluss API eventually reports real distribution data, it will be picked up when it exceeds the manual value

## Technical Details

**File:** `supabase/functions/sync-surpluss-event-allocations/index.ts`

In the `syncMaterial` function (around line 199-202), change the update logic:

**Before:**
```typescript
await supabase.from('marketplace_item_allocations')
  .update({ allocated_quantity: allocatedAmount, distributed_quantity: distributedAmount, updated_at: new Date().toISOString() })
  .eq('id', existingAlloc.id);
```

**After:**
```typescript
const finalDistributed = Math.max(existingAlloc.distributed_quantity || 0, distributedAmount);
await supabase.from('marketplace_item_allocations')
  .update({ allocated_quantity: allocatedAmount, distributed_quantity: finalDistributed, updated_at: new Date().toISOString() })
  .eq('id', existingAlloc.id);
```

This single change ensures the sync never overwrites a manually entered distributed count with a lower API value.

