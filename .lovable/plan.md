## Add Beneficiary QR Scan Evidence for Auditors

The auditor accepts the total beneficiary number (e.g. 800) but needs supporting evidence for **Step 2 — "Surpluss QR code system (unique, deactivated after session)"**. This adds a per-marketplace QR scan log they can download.

### What gets added

On the **Marketplace Reports** page, when a marketplace is selected, the existing "Export Attendance Log" Excel file gains two new sheets, and one new dedicated button is added for quick access.

#### 1. New sheet: `Beneficiary QR Evidence`
One row per QR card linked to that marketplace (from `qr_cards` + `archived_card_data`). Columns:

- QR Unique ID
- Status (active / inactive / checked_out / archived)
- Activated At (timestamp — proves the scan happened)
- Checked Out At (timestamp — proves deactivation after session)
- Gender
- Marital Status
- Nationality
- Children Count
- Total Items Collected
- Credit Balance Remaining
- Source (Active / Archived)

Footer summary row:
- Total QR Cards
- Total Activated (count where `activated_at` is not null)
- Total Checked Out (count where `checked_out_at` is not null OR status = `checked_out`)
- Total Items Distributed (sum)

#### 2. New sheet: `QR Scan Logs`
One row per traceability log entry for this marketplace from `allocation_traceability_logs` (filtered by `marketplace_id`). Columns:

- Timestamp
- Action Type (scan / distribute / reverse / etc.)
- QR Card ID
- Quantity Before
- Quantity After
- Change
- Performed By (email)
- Description

This is the raw audit trail — the actual scan events recorded by the system, signed with operator email and timestamp.

#### 3. Updated Summary sheet
Add three new rows under the existing summary:
- Total Beneficiary QR Cards
- QR Cards Activated (scan count)
- QR Cards Checked Out (deactivated)

#### 4. New button (optional convenience)
Next to "Export Attendance Log", add a second outline button **"Export QR Evidence"** that exports a standalone Excel containing only the two QR sheets above + Summary. Filename: `qr-evidence-{marketplace-name}-{date}.xlsx`.

The combined attendance file keeps the QR sheets too, so the auditor can use either file.

### Where it goes

File: `src/components/admin/MarketplaceReports.tsx` (frontend only). New data fetched inside the export handler using `supabase` directly + `fetchAllRows` for pagination — no changes to `useMarketplaceReport`.

### Technical notes

- Fetch `qr_cards` where `marketplace_id = selectedMarketplaceId` and `deleted_at is null`
- Fetch `archived_card_data` where `marketplace_id = selectedMarketplaceId`
- Fetch `allocation_traceability_logs` where `marketplace_id = selectedMarketplaceId`, ordered by `created_at asc`
- Use existing `xlsx` package and same `XLSX.utils.book_append_sheet` pattern already in the file

### Out of scope

- No backend / DB changes
- No new tables, no edge functions
- No changes to existing attendance columns
- No changes to how QR scans are recorded — only reading existing data
