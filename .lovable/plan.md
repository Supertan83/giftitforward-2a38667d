## Problem

The "Bulk Return to Warehouse" dialog stays at **Processing 0 / 11** indefinitely. Edge function logs show Surpluss `batch_update` calls returning HTTP 200 successfully, so the upstream API works — but the UI never advances past 0.

Root causes in `runBulkReturn` inside `src/components/admin/AllocationManagement.tsx`:

1. **Per-chunk progress only.** Progress is updated *after* a chunk of 8 `Promise.all` settles. If even one item in the chunk hangs, the bar stays at 0/11.
2. **No timeout on the Surpluss call.** `surplussBatchUpdateMaterials` uses `supabase.functions.invoke` with no AbortSignal, so a network stall hangs the chunk forever.
3. **One Surpluss request per item.** For 11 items we fire 11 separate `batch_update` calls. The endpoint already accepts an array — we should call it once with all materials.

## Fix

Edit only `runBulkReturn` (and a tiny helper) in `src/components/admin/AllocationManagement.tsx`. No DB or edge function changes.

### 1. Single batched Surpluss call

Before iterating, build one `materials: [{ material_id, amount: distributedQuantity }]` array for every target that has both `externalMaterialId` and `mp.external_id`. Make **one** `surplussBatchUpdateMaterials(mp.external_id, materials, "production")` call.

- If the batched call fails: stop the bulk run, toast the error, do not mutate any local row (preserves current "don't drift from Surpluss" guarantee).
- If it succeeds (or there are no Surpluss-linked items): proceed to update local DB rows.

### 2. Local DB updates with live progress + per-item resilience

Loop the targets in chunks of 8 using `Promise.allSettled` instead of `Promise.all`, and increment a `done` counter as **each** item resolves (not after the chunk):

```ts
let done = 0;
for (const chunk of chunks) {
  await Promise.allSettled(chunk.map(async (alloc) => {
    try {
      if (alloc.distributedQuantity <= 0) {
        await deleteAllocation.mutateAsync(alloc.id);
      } else {
        await updateAllocationQuantities.mutateAsync({
          allocationId: alloc.id,
          allocatedQuantity: alloc.distributedQuantity,
        });
      }
      success++;
      unitsReturned += alloc.allocatedQuantity - alloc.distributedQuantity;
    } catch {
      failed++;
    } finally {
      done++;
      setBulkProgress({ done, total: targets.length });
    }
  }));
}
```

### 3. Safety timeout on Surpluss call

Wrap the batched Surpluss call in a `Promise.race` with a 60s timeout so a hung edge function can no longer freeze the dialog. On timeout, mark as failed, surface the error toast, and abort the run.

### Out of scope

- No changes to `runBulkDistribute`, single-row Undo, edge functions, schema, or `surplussBatchUpdateMaterials` itself.
- No retry logic — failed items are reported in the final toast as today.

## Expected result

For the She Thrives Afternoon Event (11 items, 4,225 remaining): one Surpluss `batch_update` call (~1–3s) + 11 quick local DB updates with the bar advancing 1 → 2 → … → 11 in real time. No more hangs.
