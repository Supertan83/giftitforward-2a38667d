

## PDF Download for QR Cards

### Overview
Add a "Download PDF" button that generates a PDF matching the sample layout: a 4x5 grid of QR cards per page, each cell containing a large QR code with the unique ID text below, separated by thin border lines. This works for both newly generated cards and selected registered card batches.

### PDF Layout (matching sample)
- Page size: A4 portrait
- Grid: 4 columns x 5 rows = 20 cards per page
- Each cell: QR code (large, centered) + unique ID text below in monospace font
- Thin gray border lines between cells
- No extra branding/labels in cells -- just QR + ID
- Pages auto-paginate for large batches (e.g., 500 cards = 25 pages)

### Changes

#### 1. Add PDF generation function to `QRCodeGenerator.tsx`
- Import `jsPDF` (already installed in the project)
- Create a `handleDownloadPDF` function that:
  - Creates A4 jsPDF document
  - For each card, generates a QR code SVG off-screen, serializes to canvas, then draws onto the PDF page
  - Lays out cards in a 4x5 grid with borders
  - Adds the unique ID text below each QR code in monospace font
  - Auto-adds new pages every 20 cards

#### 2. Add PDF button to the header actions
- Add a new "PDF" button next to the existing Download/CSV/Print buttons
- Uses the same `activeCardIds` logic so it works for both generated and selected registered cards

#### 3. QR rendering approach
- Reuse the existing off-screen `createRoot` + `QRCodeSVG` technique for programmatic SVG generation
- Serialize SVG to data URL, draw onto a shared canvas, then use `canvas.toDataURL()` to get image data for jsPDF
- Process cards sequentially with progress indicator

### Technical Details

**Files modified:**
- `src/components/admin/QRCodeGenerator.tsx` -- add `handleDownloadPDF` function and PDF button in header

**Key implementation:**
- Use `jsPDF` with A4 dimensions (210mm x 297mm)
- Cell size: ~52.5mm wide x ~59.4mm tall (4 cols x 5 rows)
- QR code size: ~40mm centered in each cell
- Text: 8pt monospace, centered below QR
- Grid lines: 0.3pt gray strokes
- Progress toast/state for large batches

**No new dependencies** -- `jspdf` is already installed.
