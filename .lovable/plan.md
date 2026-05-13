## Goal

Mini Inventory shows "Distributed: —" because `item_types.distributed` is not maintained reliably. Compute Distributed from the GIF source-of-truth instead: sum of per-marketplace `marketplace_item_allocations.distributed_quantity` (with `marketplace_manual_counts.actual_distributed` overriding when present), grouped by `item_type_id`.

## Change

### `src/hooks/useItemTypesExtended.ts`
- After fetching `item_types`, fetch all `marketplace_item_allocations` for those item IDs (already partially done) including `id, item_type_id, marketplace_id, distributed_quantity` with `.is('deleted_at', null)`.
- Fetch `marketplace_manual_counts` for those item IDs (`item_type_id, marketplace_id, actual_distributed`) with `.is('deleted_at', null)`.
- Build `manualMap = Map<"itemId|marketplaceId", actual_distributed>`.
- For each allocation, `effectiveDistributed = manualMap.get(...) ?? distributed_quantity`.
- Sum per `item_type_id` → `distributedByItem: Record<itemId, number>`.
- Override the returned `distributed` field with `distributedByItem[item.id] ?? item.distributed ?? 0` (falls back to legacy column if no allocation rows exist).
- Marketplace-name aggregation logic stays as-is — reuse the same allocations fetch.

No UI changes needed; the existing "Distributed" column and "Remaining" calc (`totalStock - distributed`) will reflect the new numbers automatically. Donor grouping and "items with remaining" filter continue to work.

## Out of scope
- No DB schema changes.
- No edit to `item_types.distributed` writer logic.
- No changes to other consumers of `item_types.distributed` (admin dashboard, etc.).
