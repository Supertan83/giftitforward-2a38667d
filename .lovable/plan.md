## What's happening with material 990 (Toys), event 49

**On GIF (our DB):** one row, allocated = 915, distributed = 0.

**On Tractor / Surpluss (event 49):** material 990 is stored as **two separate allocation rows** for the same material:

```
material_id 990 "Toys"  → amount 130   (donation_metadata 427)
material_id 990 "Toys"  → amount 785   (donation_metadata 427)
                          total = 915
```

The source `donation_metadata 427` has **0 remaining** (everything is already allocated across events).

## Why the save fails

In `AllocationManagement.handleSaveEdit`, every save calls `surplussBatchUpdateMaterials(eventId, [{material_id: 990, amount: 915}])` — even when the user only changed `distributed` and the allocated amount didn't change.

Surpluss `PUT /donation-allocations/batch-allocation` doesn't see "915 = 130 + 785". It matches the first row (130) and treats `amount: 915` as "increase this row by 785". Since donation 427 has 0 remaining at the source, it rejects:

> Cannot increase allocation for "Toys" by 785. Only 0 remaining.

So:
- The user wanted to update **distributed** (859) / remaining (56), not allocated.
- We pushed the unchanged allocated value to Tractor anyway.
- Tractor refused because of duplicate rows + 0 source remaining.

## Plan

### 1. Stop pushing unchanged allocations to Tractor (frontend fix)

In `src/components/admin/AllocationManagement.tsx > handleSaveEdit`:
- Only call `surplussBatchUpdateMaterials` when `editAllocated !== alloc.allocatedQuantity`.
- When only `distributed` changed, skip the Tractor allocation sync entirely and just save locally (distributed is already a GIF-side concept synced separately by the distribution reporting flow).
- Apply the same guard to the bulk-edit path around line 434 if it has the same shape.

This alone unblocks the user's current scenario (they aren't actually changing 915).

### 2. Handle Surpluss duplicate-row case for real allocation changes

When the user *does* change the allocated value and Surpluss has the material split into multiple rows for the same event (as with 990 = 130 + 785):
- Before calling `batch-allocation`, detect duplicates by reading `get_donation_allocations` for that event and grouping by `material_id`.
- If duplicates exist, consolidate first: delete the smaller row(s) via `delete_allocation` (or set them to 0), then send one `batch_update` with the new total. This way Surpluss never sees a partial-row delta that exceeds source remaining.
- If consolidation can't be done automatically (e.g. source has 0 remaining and the new total > current total), surface a clearer error: "Material has duplicate allocations on Surpluss (130 + 785). Please consolidate on Tractor first."

### 3. One-time cleanup for material 990 / event 49

Independent of code changes, the data on Surpluss should be consolidated:
- Delete one of the two 990 rows on event 49.
- Re-create as a single row of 915.
- This removes the trap for any future edit on this row.

I can do this via `surpluss-allocations-api` (`delete_allocation` then `batch_update`) once you confirm.

### 4. Verification

- Re-open the Allocation Management edit for material 990 on the Inclusive Community Afternoon event.
- Change only `distributed` to 859 → save should succeed with no Tractor call.
- Then try changing `allocated` and confirm the new dedup-aware sync path works (or returns the friendlier error).

### Out of scope

- No DB schema changes.
- No changes to the marketplace-reports delete flow from the previous task.
- No change to how distributed counts are pushed to Surpluss (that path is unaffected).
