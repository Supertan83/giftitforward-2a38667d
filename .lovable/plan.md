## Add "Export Attendance Log" button on Marketplace Reports

Add a new button in the top-right of the Marketplace Reports page (the empty area outlined in your screenshot) that exports the volunteer attendance log for the selected marketplace as an Excel file.

### What the button does

- Visible only when a marketplace is selected
- Clicking it generates a `.xlsx` file named `attendance-{marketplace-name}-{event-date}.xlsx`
- One row per volunteer who attended that marketplace
- Columns:
  - Volunteer Name
  - Email
  - Phone
  - Organization
  - Assigned Zone (entrance / marketplace / exit)
  - Checked In At (date + time)
  - Checked Out At (date + time)
  - Hours Worked
  - Status (checked_in / checked_out)
- Footer summary row: Total volunteers, total hours

### Where it goes

Top-right of the page header, next to "Select Marketplace" — the empty area highlighted in red in your screenshot. On mobile (407px viewport) it stacks below the selector full-width.

### Technical notes

- File: `src/components/admin/MarketplaceReports.tsx` only (frontend change)
- Reuses existing volunteer data already fetched by `useMarketplaceReport` — no new DB queries
- Uses existing `xlsx` package (already used in `exportTraceabilityLogsToExcel`)
- Button uses `Download` icon from lucide-react, `outline` variant for visual hierarchy (primary "Send to Surpluss" stays the dominant action inside the card)

### Out of scope

- No backend / edge function changes
- No changes to attendance data itself
- No CSV format (Excel only, matches existing export convention)