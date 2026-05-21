## Goal

Give the auditor one Excel file that proves the end-to-end item lifecycle: **Donation Receipt → Marketplace Allocation → Distribution → Remaining/Reallocation**, plus a per-material summary "journey" tab.

## Where it lives

- New button **"Export Full Audit Trail"** in `src/components/admin/MarketplaceReports.tsx` header (next to the existing Attendance and QR Evidence buttons). It is system-wide, not per marketplace.
- New file `src/lib/exportAuditTrail.ts` containing the build logic, following the same pattern as `src/lib/exportTraceabilityLogs.ts` (xlsx + `fetchAllRows` for pagination).

## Workbook structure (5 sheets)

**Sheet 1 — Donation Receipt** (from `external_items` + `external_companies` + `external_material_groups` + `item_types`)
- Material ID, Material Name, Category, Subcategory, Donor (company name), Donor Sector, Quantity Received (`item_count` fallback to `quantity`), UOM, Intake Date (`created_at`), Surpluss URL.

**Sheet 2 — Marketplace Allocation** (from `marketplace_item_allocations` + `marketplace_events` + `item_types`)
- Allocation ID, Material ID, Item Name, Marketplace, Event Date, Allocated Quantity (use `original_allocated_quantity` when present, fallback to `allocated_quantity`), Allocation Date (`created_at`), Surpluss Allocation ID.

**Sheet 3 — Distribution** (aggregate per marketplace × material — explicitly NOT per scan, matching the auditor's "bulk/category level" note)
- Marketplace, Event Date, Material ID, Item Name, Category, Allocated, Distributed (`distributed_quantity`), % Distributed, First Distribution Timestamp, Last Distribution Timestamp (derived from `transactions` aggregated by marketplace+item where available, else allocation `updated_at`).
- A footer note row: *"Distribution recorded at aggregate marketplace/category level by operational scope decision."*

**Sheet 4 — Remaining / Reallocation** (from allocations where `allocated − distributed > 0`, joined to `warehouse_returns` when available)
- Marketplace, Event Date, Material ID, Item Name, Allocated, Distributed, Remaining (allocated − distributed), Returned-to-Warehouse Qty (sum from `warehouse_returns`), Reallocated-To (next marketplace allocation for same material after this event date), Return Batch Code, Return Date.

**Sheet 5 — Journey Summary** (one row per material across all events)
- Material ID, Name, Category, Donor(s), Total Received, Total Allocated (sum across events), Total Distributed, Total Remaining, # Events Used In, First Allocation Date, Last Distribution Date, Disposition Status (`Fully Distributed` / `Partially Distributed` / `Pending Reallocation`).

## Technical notes

- All queries via `fetchAllRows` to bypass the 1000-row cap; filter every table with `.is('deleted_at', null)` per project soft-delete convention.
- Distribution timestamps from `transactions` table: one paginated fetch grouped client-side by `marketplace_id` + `item_type` to avoid N+1.
- Use `xlsx` (already in project) with `autosizeCols` helper (same pattern used in `MarketplaceReports.tsx`).
- Filename: `gif-full-audit-trail-{yyyy-MM-dd-HHmm}.xlsx`.
- Show loading toast — this will fetch tens of thousands of rows; expect 10–30s.
- No DB changes, no edge function changes, no business-logic changes. Pure read + Excel build.

## Out of scope (documented in a "Methodology" note row on the Summary sheet)

- Individual-scan distribution detail (intentional operational decision).
- Recycling / rejected items (handled offline via partner certificates).
