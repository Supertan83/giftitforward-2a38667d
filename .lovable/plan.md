
# Fix: Daniella's family card hidden due to ScrollArea not scrolling

## Problem

The Radix `ScrollArea` component with `max-h-[60vh]` is not enabling proper scrolling. The family card rows overflow the visible area, and Daniella (F14R) plus Eva Marsha D. Gonzales (F6A4) are rendered in the DOM but visually clipped with no scrollbar to reach them.

The dialog has `max-h-[90vh] overflow-y-auto` on DialogContent, and the inner ScrollArea has `max-h-[60vh]`. The Radix ScrollArea component requires explicit height constraints to trigger its internal scrollbar, and `max-h` alone is not sufficient.

## Solution

Replace the Radix `ScrollArea` component with a plain `div` that uses standard CSS `overflow-y-auto` and `max-h-[60vh]`. This ensures native browser scrolling works reliably without Radix's custom scroll viewport quirks.

## File Changed

| File | Change |
|------|--------|
| `src/components/admin/PendingVolunteers.tsx` (line ~3268) | Replace `<ScrollArea className="max-h-[60vh]">` with `<div className="max-h-[60vh] overflow-y-auto">` and the closing `</ScrollArea>` with `</div>` |

## Technical Details

**Current code (line 3268):**
```
<ScrollArea className="max-h-[60vh]">
  <Table>...</Table>
</ScrollArea>
```

**Updated code:**
```
<div className="max-h-[60vh] overflow-y-auto">
  <Table>...</Table>
</div>
```

This is a minimal one-line change on the opening and closing tags. The native `overflow-y-auto` combined with `max-h-[60vh]` will produce a scrollbar once the table content exceeds 60% of the viewport height, making all family cards (including Daniella) accessible.
