## Goal

Add **bulk return remaining items to warehouse** in `AllocationManagement.tsx`, mirroring the existing **bulk distribute** flow but operating on the **Remaining** column. For each target allocation:

- New `allocated_quantity` = current `distributed_quantity` (i.e. all remaining units returned to warehouse)
- `distributed_quantity` is **unchanged** (already-distributed history preserved)
- Material ID is unchanged — same `external_material_id` stays linked to the marketplace
- Surpluss is updated via `batch_update` with `amount = distributed_quantity` (same logic as single-row Undo)

## UI changes (toolbar above the items table)

Add two new buttons next to "Distribute Selected" / "Distribute All Remaining":

- **Return Selected to Warehouse** — disabled when nothing is selected or no selected row has remaining > 0
- **Return All Remaining to Warehouse** — disabled when no row has remaining > 0

Both open a confirmation dialog (reuse the existing `bulkConfirm` pattern, extended with an `action: "distribute" | "return"` field). The dialog shows: number of items affected, total units to return, and the marketplace name. Uses `Undo2` icon (already imported) and a destructive-styled outline button.

## Logic (`runBulkReturn`)

New handler modelled on `runBulkDistribute`:

1. Filter `allocations` to those in `ids` with `remaining = allocated - distributed > 0`.
2. For each row in chunks of 8 (same concurrency as bulk distribute):
   - If row has `externalMaterialId` and the marketplace has `external_id`: call `surplussBatchUpdateMaterials(marketplace.external_id, [{ material_id, amount: distributed }], "production")`. On failure, count as failed and **do not** mutate the local row.
   - On Surpluss success (or when no external linkage exists): 
     - If `distributed === 0` → `deleteAllocation` (matches single-row Undo behavior).
     - Else → `updateAllocationQuantities({ allocationId, allocatedQuantity: distributed })`.
   - Track `unitsReturned += remaining` and success/fail counters.
3. Update progress bar (`bulkProgress`).
4. Log one summary `traceability` event with `actionType: "returned_to_warehouse"`, e.g. *"Bulk return: 7 item(s), 2,144 units returned to warehouse from {marketplace}"*.
5. Toast result and clear `selectedAllocIds`.

## Confirmation dialog content

> Return remaining items to warehouse?
>
> This will return **{unitsToReturn}** unit(s) across **{itemCount}** item(s) from **{marketplace}** back to the warehouse pool. Distributed quantities and material IDs are kept unchanged. Surpluss will be updated to reflect the new allocated amounts.

Destructive-style confirm button.

## Out of scope

- No DB schema changes.
- No edge function changes.
- No changes to the single-row Undo dialog.
- No changes to distributed totals on any row.

Awaiting approval.