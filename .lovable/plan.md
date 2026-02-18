

## Fix Beneficiary QR Code Generator: Unlimited Quantity + PNG/ZIP Download

### Problems
1. Quantity is capped at 100 -- users need to create more at once
2. Download currently exports a CSV of IDs, not actual QR code images
3. No way to download individual QR codes as PNG or bulk download as ZIP

### Changes

#### 1. Remove the 100-card limit
- Change max from 100 to 1000 in both the validation logic and the HTML input `max` attribute
- Update the error message accordingly

#### 2. Add individual PNG download per card
- Each generated QR card gets a small download icon button (next to the existing delete button)
- Clicking it renders the QR SVG to a canvas, converts to PNG, and triggers a download named `{uniqueId}.png`

#### 3. Replace "Export CSV" with "Download All (ZIP)"
- Install `jszip` package (lightweight ZIP library)
- The "Download All" button renders every QR card to PNG in-memory, bundles them into a ZIP file using JSZip, and triggers download as `qr-cards-YYYY-MM-DD.zip`
- Each PNG inside the ZIP is named `{uniqueId}.png`
- Show a progress indicator during ZIP generation for large batches

#### 4. Keep CSV export as secondary option
- Move CSV export to a smaller/secondary button so users can still get the ID list if needed

### Technical Details

**New dependency:** `jszip` (for creating ZIP files in the browser)

**PNG generation approach:**
- Use the existing `QRCodeSVG` component's SVG output
- Create an offscreen canvas, draw SVG as image, add the card ID text and branding below the QR code
- Export as PNG blob

**File modified:** `src/components/admin/QRCodeGenerator.tsx`
- `handleGenerate`: change max from 100 to 1000
- New `downloadCardAsPng(uniqueId)` function: renders a single QR card to PNG
- New `handleDownloadAllZip()` function: loops through all cards, generates PNGs, bundles into ZIP
- Update header buttons: "Download All" (ZIP) as primary, CSV as secondary
- Add download icon button to each card in the grid

**Helper function (PNG rendering):**
```text
1. Create canvas (e.g. 400x500)
2. Fill white background
3. Draw QR code (from SVG -> Image -> canvas)
4. Draw card ID text below QR
5. Draw "GIF (GIFT IT FORWARD)" branding
6. Export canvas.toBlob('image/png')
```

