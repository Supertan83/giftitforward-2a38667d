

## Fix Marketplace Dropdown Content Overflow

The marketplace name, status badge, and icon inside select dropdowns don't fit properly, especially on mobile. The content overflows because it uses a flex row with no truncation.

### Changes

**1. `src/components/admin/AllocationManagement.tsx`** (3 dropdowns)
- Main marketplace selector (line ~311): Remove the inline `MapPin` icon and status badge from inside `SelectItem`. Show only the marketplace name as plain text, keeping it simple and fitting.
- Allocate modal marketplace selector (line ~589): Same simplification.
- Re-allocate target marketplace selector (line ~717): Same simplification.
- Alternatively, keep icons but add `truncate` / `overflow-hidden` / `min-w-0` classes so long names get truncated with ellipsis instead of overflowing.

**2. `src/components/admin/MarketplaceSyncPanel.tsx`** (1 dropdown)
- Marketplace selector (line ~181): Remove the `Badge` from inside the `SelectItem` or move it outside. Apply truncation classes to the marketplace name.

### Approach
- Simplify `SelectItem` content to just the marketplace name text (no icons, no badges inside the dropdown items).
- Keep the status info visible via the selected marketplace details shown below the dropdown (already exists in both components).
- Add `truncate` class to `SelectTrigger` content span to handle long selected values.

### Technical Details
- In all 4 dropdowns across the 2 files, replace the `<div className="flex items-center gap-2">` wrapper inside `SelectItem` with just the marketplace name string.
- Add `className="truncate"` or `max-w-full overflow-hidden text-ellipsis` to the trigger if needed.
- This ensures the dropdown fits on all screen sizes without horizontal overflow.

