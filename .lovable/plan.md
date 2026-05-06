## Add QR Code Column to Volunteer List

Add a new "QR Code" column to the Volunteer List table in `src/components/admin/MarketplaceReports.tsx`. Each row gets a small QR icon button; clicking it opens a popup dialog showing the volunteer's QR code (rendered from their `cardId`) along with their info (name, category, company, status, hours, check-in/out times).

### Changes

**File: `src/components/admin/MarketplaceReports.tsx`**

1. Import `QRCodeSVG` from `qrcode.react` and the `QrCode` icon from `lucide-react`. Import `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` from `@/components/ui/dialog`.
2. Add state: `const [qrVolunteer, setQrVolunteer] = useState<any | null>(null);`
3. Update the desktop table:
   - Adjust `<colgroup>` widths to fit 8 columns (e.g. 5 / 20 / 13 / 14 / 13 / 10 / 12 / 13).
   - Add a new `<th>` "QR Code" between Status and Hours (or right after Name — placing it after **Name** matches the user's screenshot context best — final placement: right after Name column).
   - In each row, add a `<td>` with a ghost icon `Button` containing the `QrCode` icon. Disabled when `vol.cardId` is missing. `onClick={() => setQrVolunteer(vol)}`.
4. Update the mobile card layout: add a small QR icon button next to the Edit/Delete buttons, same disabled rule and click handler.
5. Add a `<Dialog>` at the bottom of the component (next to existing dialogs):
   - Open when `qrVolunteer` is truthy.
   - Content: centered `QRCodeSVG value={qrVolunteer.cardId} size={220}` with margin, then volunteer info block: name (bold), card ID (mono, small), category, company, status badge, hours, and check-in/check-out timestamps if present.
   - If `cardId` is missing, show a "No QR card assigned" empty state instead of the QR.

### Technical Notes

- `qrcode.react` is already a project dependency (used in `VolunteerQRCardsViewer.tsx` and `VolunteerQRCodeGenerator.tsx`).
- `vol.cardId` is the QR unique ID encoded into the QR (matches existing pattern in `VolunteerQRCardsViewer.tsx`).
- No DB or backend changes required — purely UI.

### Out of Scope

- Printing / downloading the QR from the popup (can be added later if needed).
- Bulk QR export from this view.