## Add Excel Export to Traceability Logs

Add an "Export to Excel" button in the Traceability Logs header (next to the back button / page title) that exports the currently filtered logs to an `.xlsx` file.

### Behavior
- Button appears in the top header of `TraceabilityLogsViewer` (right side, aligned with the title row).
- Exports the **currently filtered** result set respecting Marketplace, Action, and QR Card search filters.
- To avoid the 500-row UI cap, the export runs its own query using the same filters but without the limit (fetched via `fetchAllRows` for safety).
- Filename: `traceability-logs-YYYY-MM-DD-HHmm.xlsx`.
- Disabled while loading; shows a spinner during export; toast on success/failure.

### Columns
| Column | Source |
|---|---|
| Timestamp | `created_at` formatted `yyyy-MM-dd HH:mm:ss` |
| Action | `action_type` |
| Marketplace | `marketplace_name` |
| QR Card | `card_unique_id` |
| Quantity Before | `quantity_before` |
| Quantity After | `quantity_after` |
| Quantity Change | `quantity_after - quantity_before` |
| Performed By | `performed_by_email` |
| Description | `description` |

Header row bold, columns auto-sized, frozen header row.

### Technical notes
- Use existing `xlsx` / `exceljs` if already in the project; otherwise add `xlsx` (SheetJS) — small, sync, ideal for this. Will check `package.json` first and reuse what's installed.
- New helper: `src/lib/exportTraceabilityLogs.ts` that takes filters, fetches all matching rows via `fetchAllRows`, builds the workbook, and triggers download.
- Edit `src/components/admin/TraceabilityLogsViewer.tsx` to add the `Download` (lucide) button in the header and wire it to the helper.
- No backend / RLS / schema changes needed.
