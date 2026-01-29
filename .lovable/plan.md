

# Plan: Add Export Reports for Volunteers

## Problem Summary
You need the ability to export volunteer reports from the "Volunteers Added" section. The export should allow you to:
1. Choose a date or date range
2. Generate an Excel/CSV report with volunteer data
3. Download the file

## Solution Overview
Add an "Export Report" button with a date range picker dialog that generates a downloadable Excel-compatible CSV file containing volunteer data filtered by the selected date range.

## Implementation Steps

### 1. Add Export Dialog State and UI Elements
**File: `src/components/admin/PendingVolunteers.tsx`**

- Add new state variables for:
  - `showExportDialog` - controls dialog visibility
  - `exportStartDate` - start date for the export range
  - `exportEndDate` - end date for the export range
  - `isExporting` - loading state during export

- Add new imports:
  - `CalendarIcon, Download` from lucide-react
  - `Calendar` from `@/components/ui/calendar`
  - `Popover, PopoverContent, PopoverTrigger` from `@/components/ui/popover`
  - `format` from `date-fns`

### 2. Create Export Report Dialog
**File: `src/components/admin/PendingVolunteers.tsx`**

Add a dialog with:
- Two date pickers (Start Date and End Date) using the Calendar component
- Preview of how many volunteers will be included
- "Export to Excel" button
- Cancel button

### 3. Implement Export Function
**File: `src/components/admin/PendingVolunteers.tsx`**

Create `handleExportReport` function that:
1. Queries the database for volunteers within the selected date range
2. Formats data into CSV with columns:
   - Full Name
   - Email
   - Phone Number
   - Gender
   - Employee Status (Yes/No)
   - Company/Vertical
   - Events Registered
   - Training Completed (Yes/No)
   - Email Sent (Yes/No)
   - Created Date
3. Triggers file download with proper filename including date range
4. Shows success/error toast

### 4. Add Export Button to Header
**File: `src/components/admin/PendingVolunteers.tsx`**

Add an "Export" button next to the existing "Refresh" button in the header that opens the export dialog.

## Technical Details

### Date Range Picker UI Layout
```text
+---------------------------------------+
|        Export Volunteer Report        |
+---------------------------------------+
| Start Date:  [Calendar Picker    v]   |
| End Date:    [Calendar Picker    v]   |
|                                       |
| Preview: 45 volunteers in range       |
|                                       |
| [Cancel]            [Export to Excel] |
+---------------------------------------+
```

### CSV Export Format
| Full Name | Email | Phone | Gender | Employee | Company | Events | Training | Email Sent | Created |
|-----------|-------|-------|--------|----------|---------|--------|----------|------------|---------|
| John Doe | john@example.com | +971... | Male | Yes | Dubai Holding | Event 1, Event 2 | Yes | Yes | 2026-01-15 |

### File Naming Convention
`volunteers-report-YYYY-MM-DD-to-YYYY-MM-DD.csv`

Example: `volunteers-report-2026-01-01-to-2026-01-29.csv`

## Files to Modify
1. `src/components/admin/PendingVolunteers.tsx` - Add export dialog, date pickers, and export function

## Benefits
- Quick access to volunteer data for reporting
- Filter by date range to get specific periods
- Excel-compatible CSV format for easy data analysis
- Includes all relevant volunteer information
- Works with the existing tab filtering (exports from current tab)

