## What the Surpluss API actually returns

Direct call to `GET /api/common/donation-allocations?event_id=32` (production, today):

```text
allocation.id = 22
allocation.total_amount = 8,347
per material:
  amount             ──┐  ALL THREE ARE EQUAL across every line item
  distributed_amount ──┤  (478=478, 404=404, 1064=1064, 0=0, etc.)
                       └── for D032 AND D038 AND D040
  remaining_amount   ── independent number, sums to 7,812 (D032) / 8,207 (D038)
```

The 7,812 / 8,207 the auditor sees in Excel is Surpluss's per-material `remaining_amount`. In Surpluss's model that field represents **leftover donor inventory across all events** — not "still owed to this event". This is structurally true on the Surpluss platform itself; GIF is reading it correctly.

## So why does `amount` always equal `distributed_amount`?

Surpluss reconciles allocation to actuals at the end of an event. Whatever was originally pledged but not distributed is released back to donor inventory (and shows up in `remaining_amount`). After that reconciliation, `amount` and `distributed_amount` are identical — by design — and the historical "originally pledged" figure is gone from Surpluss's API.

## What we cannot do

- We cannot retroactively recover the pre-reconciliation "originally requested" number for D032, D038, D040 — Surpluss has overwritten it.
- We cannot make Surpluss's "Items Requested" UI label show Distributed + Remaining without changes on Surpluss's side; that math conflates two unrelated quantities and would break their reporting elsewhere.

## What we CAN do (the plan)

### 1. Capture an "original allocated" snapshot in GIF on first sync

```text
marketplace_item_allocations
  + original_allocated_quantity  integer  nullable
  + original_allocated_synced_at timestamptz
```

Behavior in `allocate-donations-to-marketplace` and `sync-surpluss-event-allocations`:
- On INSERT: set `original_allocated_quantity = amount`, set timestamp
- On UPDATE: only update `allocated_quantity` and `distributed_quantity`; never touch `original_*`

This preserves the pre-reconciliation pledge for every future event from this point forward. Past events will show NULL — we'll display them as "n/a (synced after reconciliation)".

### 2. Add an audit-grade "Original Allocation vs Final" panel to Marketplace Reports

For each event, show a clean three-column breakdown auditors can read directly:

```text
┌──────────────────┬──────────────┬─────────────────┬──────────────┐
│ Item             │ Originally   │ Distributed     │ Returned to  │
│                  │ Allocated    │ at Event        │ Donor Stock  │
├──────────────────┼──────────────┼─────────────────┼──────────────┤
│ Towels           │ 482          │ 478             │ 4            │
│ Mixed bedding    │ 557          │ 404             │ 153          │
│ ...              │              │                 │              │
└──────────────────┴──────────────┴─────────────────┴──────────────┘
```

For events that pre-date this fix, the "Originally Allocated" column shows: *"Reconciled to actuals — see Surpluss for original pledge"*.

### 3. Draft an auditor-facing one-pager

A short PDF/printable explainer (placed inside Marketplace Reports under "Methodology") that defines each Surpluss field with screenshots — so any future auditor reading "Items Remaining" understands it is donor inventory, not unfulfilled allocation. This neutralises the recurring misinterpretation.

### Out of scope for this plan
- Changing Surpluss's UI labels (their platform, not ours)
- Backfilling original allocation for past events (data is gone upstream)
- Touching `report-surpluss-distribution` — verified it is not the cause

### Files touched

- `supabase/migrations/...` — add two columns
- `supabase/functions/allocate-donations-to-marketplace/index.ts` — set originals on insert only
- `supabase/functions/sync-surpluss-event-allocations/index.ts` — same guard
- `src/components/admin/MarketplaceReports.tsx` (and/or a new `OriginalAllocationAuditPanel.tsx`)
- `src/components/admin/MethodologyDialog.tsx` (new) — auditor explainer
