## Goal

Turn the current "Export Full Audit Trail" Excel into a deliverable that protects the GIF 2027 contract: branded like Dubai Holding, every discrepancy either resolved with a documented reason or clearly flagged as truly unexplained.

Single file changes — no DB work, no edge functions, no UI flow changes. Ship this week.

## Where the work happens

- `src/lib/exportAuditTrail.ts` — rewrite workbook builder to use `xlsx-js-style` (drop-in replacement of `xlsx`, supports cell styling). All sheet rebuilding logic stays; we add styling + a discrepancy classification layer.
- `src/lib/discrepancyResolver.ts` *(new)* — pure function: given platform vs auditor numbers per Material ID, returns `{ status, reasonCode, explanation }`. Centralises the "known cause" rules so we can extend them without touching the export.
- `src/components/admin/MarketplaceReports.tsx` — only change is the success-toast wording (reports resolved vs unexplained counts).

No other files touched.

## Sheet-by-sheet changes

### 1. Methodology (cover) — rebuilt as a branded cover page
- DH Red (`#E41E26`) header band spanning A1:B1, white Merriweather-style bold title "GIF 2026 — Audit Trail Report", subtitle with generated timestamp + programme name.
- Reorganised into 4 labelled blocks with section headers (filled DH Grey background, white text): **Purpose**, **Reconciliation Headline** (auditor totals vs platform live in a 2-col mini-table with green/red Δ pill), **Methodology & Data Sources**, **Known Gaps & Auto-Resolutions**.
- Footer block with "Prepared by GIF Platform / Reviewed by ___ / Date ___" sign-off lines.
- Column widths and row heights tuned for print (A4 landscape).

### 2. Material Movement Ledger
- Header row: DH Red fill, white bold text, frozen.
- Per-material RECEIVED row gets a light DH Red tint (`#FCE7E9`) so blocks are visually scannable.
- `Final Disposition` cell colored: green = Fully Distributed, amber = Partially Distributed, blue = GIF 2027 Stock, grey = No Allocation.
- `Audit Scope` cell tinted grey when "Out of audit scope".
- Numbers right-aligned with thousands separators via cell number format `#,##0`.
- Existing data logic unchanged.

### 3. Summary by Marketplace
- Same brand header.
- Adds totals row at bottom (SUM of Items Allocated / Distributed / Returned) — bold, top border, DH Grey tint.
- `Audit Scope` column conditional-tinted.
- Beneficiaries column gets a footnote symbol † when value came from `manual_beneficiary_count` (no QR backup) — small marker so auditor can ask before assuming.

### 4. GIF 2027 Closing Stock
- Brand header.
- Totals row.
- Sorted by Remaining Qty desc so the biggest carry-overs are at the top.

### 5. Reconciliation Check
- Brand header.
- `Δ` cells: green fill when 0, amber when |Δ| ≤ 1% of reference, red when larger.
- New rightmost column **"Status"** populated by the resolver: `Match`, `Within tolerance`, `Documented variance`, `Unexplained`.
- New column **"Explanation"** — pre-filled for the rows where we know the cause (see resolver rules below).

### 6. Discrepancy Report — biggest change
Discrepancies are now classified, not just listed. Sort order: **Unexplained first**, then Documented, then Resolved (Match).

New columns appended to existing layout:
- **Reason Code** (short tag, e.g. `SURPLUSS_RECONCILE`, `IN_KIND`, `SCOPE_DIFF`, `MANUAL_COUNT`, `UNEXPLAINED`).
- **Auto-Resolution** — written justification taken from the resolver table.
- **Status** — colored: green `Resolved`, amber `Documented`, red `Unexplained`.

Auditor opens this sheet and immediately sees: "only X rows are red — everything else has a stated reason."

### 7. Auto-Resolution Log *(new sheet, last)*
A transparent audit of the resolver itself: every rule we apply with its definition, threshold, and the count of Material IDs it affected. This is what wins trust — we are not hiding mismatches, we are explaining them with a documented rule the auditor can challenge.

Columns: Rule Code · Trigger Condition · Explanation Text · Materials Affected · Total Δ Auto-Resolved.

## Discrepancy resolver rules (`src/lib/discrepancyResolver.ts`)

Applied in this order per Material ID:

1. **MATCH** — all three deltas (received, distributed, remaining) are 0 → Status `Resolved`.
2. **WITHIN_TOLERANCE** — |Δ| ≤ 1% of auditor reference AND ≤ 5 units on each metric → Status `Resolved` ("Within rounding / batch-count tolerance").
3. **SURPLUSS_RECONCILE** — platform `distributed` matches auditor, but platform `allocated_quantity` < `original_allocated_quantity` → Status `Documented` ("Surpluss post-event reconciliation released unused pledge back to donor stock; original pledge preserved in snapshot").
4. **IN_KIND** — Material ID donor name includes "Al Jaber" OR external_companies sector flagged in-kind → Status `Documented` ("In-kind donation; received qty reflects platform total, auditor sheet excludes in-kind line").
5. **MANUAL_COUNT** — platform `manual_beneficiary_count` set but no QR transactions for any allocation of this material → Status `Documented` ("Beneficiary count from manual partner sign-off, no per-card scan log available").
6. **SCOPE_DIFF** — Material ID only on platform, not in auditor reference → Status `Documented` ("Out of audit scope — donated/distributed via non-tracked channel").
7. **MISSING_ON_PLATFORM** — Material ID only in auditor reference → Status `Unexplained` ("Reference row not present on platform — requires investigation"). 
8. **UNEXPLAINED** — anything else → Status `Unexplained`. This is the list we want to be small.

Each rule is a single function returning `{ matched: boolean, reasonCode, explanation }`. The resolver loops rules in order and returns the first match. Easy to add/edit.

## Styling implementation notes

```text
Library: xlsx-js-style (drop-in replacement of xlsx, supports cell-level
fills, fonts, borders, number formats). Installed via bun add.
Brand tokens (constants in exportAuditTrail.ts):
  DH_RED        = FFE41E26
  DH_RED_TINT   = FFFCE7E9
  DH_GREY       = FF4A4A4A
  DH_GREY_TINT  = FFEAEAEA
  STATUS_GREEN  = FFD1FAE5
  STATUS_AMBER  = FFFEF3C7
  STATUS_RED    = FFFEE2E2
  STATUS_BLUE   = FFDBEAFE
Helper styleCell(ws, addr, { fill, font, alignment, numFmt, border })
applied after json_to_sheet so existing row-building stays untouched.
```

## Filename
Unchanged: `gif-item-level-stock-movement-{yyyy-MM-dd-HHmm}.xlsx`.

## Out of scope (explicit)
- No PDF executive summary, no ZIP bundle (user picked "one Excel").
- No DB / edge function / business-logic fixes — if the resolver flags something as `Unexplained`, that becomes a follow-up ticket, not part of this change.
- No new export button — same trigger, polished output.

## Verification before delivery
1. Build the file against the live DB, open in Excel, visually confirm DH header, frozen panes, conditional fills, totals rows on all sheets.
2. Confirm the Discrepancy Report has all red rows at the top and the count matches the success toast.
3. Confirm Auto-Resolution Log totals reconcile: `Σ Materials Affected` across rules = total non-matching Material IDs.
