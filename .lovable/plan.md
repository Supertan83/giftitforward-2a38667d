

# Add Copyable/Downloadable Volunteer Schema Page

## Problem
On mobile, the user cannot easily copy the volunteer schema information to share with Surpluss IT. The browser copy functionality is unreliable on phone browsers.

## Solution
Create a dedicated admin page/dialog with:
1. A "Copy to Clipboard" button that copies all schema info as formatted text
2. A "Download as Text File" button that saves a `.txt` file with the full schema
3. Both buttons work reliably on mobile browsers

## Changes

### 1. New Component: `src/components/admin/VolunteerSchemaExport.tsx`
- A card/section within the admin dashboard (or a dialog triggered from a button)
- Displays the volunteer schema in a readable format
- Two action buttons at the top:
  - **Copy All** -- uses `navigator.clipboard.writeText()` with a fallback for mobile (creating a temporary textarea element)
  - **Download .txt** -- creates a Blob and triggers a file download (`volunteer-schema.txt`)
- The schema content includes:
  - `pending_volunteers` table fields (all columns, types, descriptions)
  - `volunteer_qr_cards` tracking fields
  - `volunteer_attendance` shift records
  - `marketplace_events` demographics
  - Current sync payload format
- Toast notification confirms "Copied!" or "Downloaded!"

### 2. Add to Admin Dashboard (`src/components/admin/AdminDashboard.tsx`)
- Add a new tab or button in the Volunteers section labeled "Export Schema for Surpluss IT"
- Opens the schema export component

### Technical Details

**Mobile-safe copy fallback:**
```text
1. Try navigator.clipboard.writeText()
2. If that fails, create a hidden textarea, select its content, run document.execCommand('copy')
3. Show toast confirmation either way
```

**Download implementation:**
```text
1. Create a Blob with the schema text
2. Create an object URL
3. Create a temporary anchor element with download attribute
4. Trigger click programmatically
5. Clean up URL and element
```

No database changes needed -- this is purely a UI feature that displays static schema documentation.

