## Problem

When you click **Sync Surpluss** on Mens Aviation Workers Marketplace - Morning Event, the toast says "Synced 30 allocations (0 created, 30 updated)" — but the page only shows 1 item. The other 29 items appear to be missing.

### Root cause

On 2026-04-30 (yesterday), 29 of the 30 allocation rows for that marketplace were soft-deleted (likely via the bulk delete added recently). The `surpluss_allocation_id = 19` is shared across all 30 items because Surpluss returns them inside one container with 30 `allocated_materials`.

When sync runs now, the lookup in `sync-surpluss-event-allocations`:

```ts
.from("marketplace_item_allocations")
.select("id, allocated_quantity, distributed_quantity")
.eq("marketplace_id", marketplace.id)
.eq("item_type_id", resolvedItemType.id)
.maybeSingle();
```

does **not** filter `deleted_at IS NULL`. So it finds the soft-deleted (tombstoned) row, **updates it**, and never creates a fresh one. The toast happily reports "30 updated" but the UI only shows the 1 row that was never deleted ("Men Clothes").

This will affect any marketplace where allocations were ever bulk-deleted and then re-synced.

## Fix

### 1. `supabase/functions/sync-surpluss-event-allocations/index.ts`

Update the existence check so soft-deleted rows are treated as "missing" and resurrected:

- Add `.is("deleted_at", null)` to the existing-allocation lookup, **OR** prefer fetching the soft-deleted row and clearing its `deleted_at` (resurrect) so we don't lose history.
- Recommended: detect existing row regardless of deletion state. If `deleted_at IS NOT NULL`, set `deleted_at = NULL` in the update payload (resurrect). This preserves the row id and any references.

### 2. One-time data repair for Mens Aviation Morning + Afternoon

Restore the 29 soft-deleted allocations for marketplace `3f44eb86-...` (Morning, ext 35) and check Afternoon (ext 36) for the same pattern. This is a single SQL update:

```sql
UPDATE marketplace_item_allocations
SET deleted_at = NULL, updated_at = now()
WHERE marketplace_id IN (
  '3f44eb86-f1c5-48a4-8bf3-5b70b41c5bfd',
  'accc4d0e-de1f-4625-90e1-79c810f7d1fe'
)
AND deleted_at IS NOT NULL
AND surpluss_allocation_id IS NOT NULL;
```

(Run via migration tool.)

### 3. Audit other marketplaces

Run the same restore for any marketplace whose allocations were soft-deleted but Surpluss still has the matching `surpluss_allocation_id` in our table. Limit to events with `event_date >= today - 7 days` to avoid restoring genuinely retired data.

## Out of scope (separate issue, mention only)

For the **Single Mothers Household Workers Marketplace** events (this Saturday), `total_fetched: 0` from Surpluss `/donation-allocations?event_id=44/46`. That means **no allocations have been created on the Surpluss side yet** for those event IDs — admin must allocate items there first, then sync. No code fix needed; I'll mention in the summary.

## Files to edit

- `supabase/functions/sync-surpluss-event-allocations/index.ts` — resurrect soft-deleted rows on sync
- new migration — one-time restore for Aviation events (and any other recent ones with the same pattern)
