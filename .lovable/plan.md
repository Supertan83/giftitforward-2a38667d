

## New "Item List" Admin Section with QR Codes

### Overview
Add a new admin view called **Item List** that displays all items from the `item_types` table with their full details and a QR code for each item's Surpluss platform URL. When an admin selects an item, they see expanded details including the QR code.

### Changes

**1. Update the `ItemType` type to include `surplussUrl`**
- File: `src/types/index.ts`
- Add `surplussUrl?: string | null` to the `ItemType` interface

**2. Update `useItemTypes` hook to return `surplussUrl`**
- File: `src/hooks/useSupabaseData.ts`
- Map `item.surpluss_url` to `surplussUrl` in the query result

**3. Create new component: `src/components/admin/ItemListViewer.tsx`**
- Displays a list/table of all items from `item_types`
- Each row shows: icon, name, category, material ID, total stock, distributed count
- Clicking an item expands/opens a detail panel showing:
  - All item info
  - A QR code generated from the `surpluss_url` using the `qrcode.react` library (already installed)
  - A clickable link to the Surpluss platform URL
  - Option to download/print the QR code

**4. Add "Item List" to the admin sidebar**
- File: `src/components/admin/AdminSidebar.tsx`
- Add a new menu item under **Admin Apps** with a `List` or `Package` icon
- New view key: `'item-list'`

**5. Register the view in `AdminDashboard.tsx`**
- File: `src/components/admin/AdminDashboard.tsx`
- Add `'item-list'` to the `AdminView` type
- Import and render `ItemListViewer` in the `renderContent` switch

### Technical Details

- QR codes will be generated client-side using `qrcode.react` (already a project dependency)
- Each QR encodes the URL: `https://platform.thesurpluss.com/material/{external_material_id}`
- The component will use the existing `useItemTypes()` hook for data
- Item selection will use local state to toggle an expanded detail view with the QR code
- QR download will use canvas export from `QRCodeCanvas`

