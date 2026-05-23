## Goal

Replace the current "Export Full Audit Trail" output with an Excel workbook that mirrors the auditor's `GIF_2026_Item_Level_Stock_Movement.xlsx` structure exactly — so the platform export can be submitted alongside it and reconciled line-by-line.

## What changes (single file)

`src/lib/exportAuditTrail.ts` — rewrite the workbook builder. The header button in `MarketplaceReports.tsx` stays the same; only the output changes. No DB changes, no edge functions.

## Workbook structure (5 sheets, same names/order as the auditor file)

### 1. Methodology
Static cover page mirroring the auditor's text: purpose, data sources, reconciliation summary, stock-movement logic, platform note. Auto-filled totals pulled from live platform numbers so the auditor can see platform-vs-reference at a glance.

### 2. Material Movement Ledger  *(the core sheet)*
One Material ID = a **block of stacked rows** separated by a blank row, exactly like the reference:

| Material ID | Donor | Category | Item Description | Qty Received | Warehouse Intake Date (manual) | Movement Type | Marketplace | Event Date | Qty Allocated | Qty Distributed | Qty Returned | Return Count Date | Reallocated To | Final Disposition | GIF 2027 Qty |

Per-material rows:
- Row 1: `RECEIVED` — from `external_items` (qty = `item_count` ?? `quantity`, date = `created_at`, donor = `external_companies.name`). New empty column **"Warehouse Intake Date (manual)"** so you can paste the true intake date.
- Rows 2..N: `ALLOCATED → DISTRIBUTED` — one row per marketplace the material appears in, ordered by event_date. Columns filled: Marketplace name, Event Date, Qty Allocated (prefer `original_allocated_quantity`), Qty Distributed, Qty Returned (= allocated − distributed when >0), Return Count Date (from `warehouse_returns.returned_at` when present, else blank), Reallocated To (next marketplace in chronological order for the same material, when remaining > 0).
- Final cell of block: `Final Disposition` = `Fully Distributed` / `GIF 2027 Stock` / `Partially Distributed` and `GIF 2027 Qty` if applicable.

### 3. Summary by Marketplace
One row per marketplace, matching the auditor's columns: Marketplace, Sheet (MP#), Event Date, Outreach Partner, Beneficiaries, Items Allocated, Items Distributed, Items Returned, Return Count Date.
- All 57 platform marketplaces included. Out-of-scope ones (not in the auditor's 35) get a trailing column **"Audit Scope"** = `Out of audit scope` so the auditor can filter.

### 4. GIF 2027 Closing Stock
One row per Material ID where total remaining > 0 across all events: Material ID, Donor, Category, Item Description, Remaining Qty, Source Marketplace (last event the item appeared in).

### 5. Reconciliation Check
Side-by-side totals: Auditor Reference vs Platform Live, with delta column:
- Total Received (auditor 545,611 / platform live)
- Platform Total incl. Al Jaber in-kind
- Total Distributed (auditor 500,155)
- Total Remaining (auditor 44,801)
- Total Allocated incl. reallocations (auditor 634,459)
- Total Returned (auditor 134,304)
- Marketplace count (35 vs 57)
- # Materials with remaining stock (47 vs platform count)

### 6. Discrepancy Report  *(new — answers the user's "cross-check" ask)*
Per-Material-ID diff against the uploaded reference file. The reference values are **bundled into the codebase** as a typed constant (`src/lib/auditReferenceLedger.ts`) generated from the uploaded xlsx so the diff is fully client-side and reproducible:

| Material ID | Item | Auditor Received | Platform Received | Δ | Auditor Distributed | Platform Distributed | Δ | Auditor Remaining | Platform Remaining | Δ | Status |

`Status` = `MATCH` / `MISMATCH` / `MISSING ON PLATFORM` / `EXTRA ON PLATFORM`. Rows sorted so mismatches surface at the top.

## Technical notes

- All fetches via `fetchAllRows` with `.is('deleted_at', null)` (per project soft-delete rule).
- Tables read: `external_items`, `external_companies`, `external_material_groups`, `item_types`, `marketplace_item_allocations`, `marketplace_events`, `warehouse_returns`. No transaction-table scan (kept fast).
- Reallocation linkage = next chronological allocation (by `marketplace_events.event_date`) for the same `item_type_id` where the previous allocation had remaining > 0.
- Reference data: parse the uploaded xlsx once and commit `src/lib/auditReferenceLedger.ts` containing `{ materialId, qtyReceived, totalDistributed, totalRemaining, perMarketplace[] }[]` for all ~340 materials in the reference file. Pure data, no UI.
- Filename: `gif-item-level-stock-movement-{yyyy-MM-dd-HHmm}.xlsx`.
- xlsx is already a project dep; uses existing `autosizeCols` pattern.

## Known gaps surfaced (not silently hidden)

1. **Intake date** = platform `created_at`. A blank `Warehouse Intake Date (manual)` column is added so the user can paste the true Warehouse Intake Log dates before submission.
2. **MP scope**: all 57 included with `Out of audit scope` tag on the extras.
3. **Recycling/Rejected (651)**: not tracked on platform; noted in Methodology sheet only.

## Out of scope

- No DB changes, no new tables, no edge function changes, no business-logic fixes to allocation/distribution numbers. The export is a read-only reconciliation tool — fixing any mismatches it surfaces is a separate follow-up.
