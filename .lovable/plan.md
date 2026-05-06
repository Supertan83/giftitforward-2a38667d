## Problem

In the new "QR Code" popup on the admin **Marketplace Reports → Volunteer List**, the QR is generated from `vol.cardId`, which is the `volunteer_qr_cards.id` (a UUID). The scanner pipeline (e.g. `QRScanner`, entrance/exit zones) matches on the card's `unique_id` (the human-readable code stored in `qr_cards.unique_id` / `volunteer_qr_cards.unique_id`). So when an admin scans the popup QR, lookup fails → "failed".

All other QR rendering in the app uses `unique_id` (see `VolunteerQRCardsViewer.tsx` line 671 and `VolunteerQRCodeGenerator.tsx`).

## Fix

Surface the card's `unique_id` alongside `cardId` in the volunteer list, then render the QR from `unique_id`.

### 1. `src/hooks/useMarketplaceAllocations.ts`
- Extend the `volunteerList` row type to include `uniqueId?: string`.
- Wherever a row is built with `cardId`, also populate `uniqueId` from the same source:
  - Active rows: from `attendanceRecords[*].volunteer_qr_cards.unique_id` (already loaded in `volCardMap` enrichment block).
  - Inactive rows: from the matched `volunteer_qr_cards.unique_id` (primary + family) added in the previous change.
- No DB changes.

### 2. `src/components/admin/MarketplaceReports.tsx`
- Update the local volunteer row type to include `uniqueId?: string`.
- In the QR popup `<Dialog>`:
  - Render `<QRCodeSVG value={qrVolunteer.uniqueId} ... />` instead of `cardId`.
  - Show `uniqueId` (mono, small) under the name as the human-readable card code; keep `cardId` out of the UI (internal UUID, not useful to staff).
  - Disable the QR icon button when `uniqueId` is missing (instead of `cardId`), and show the "No QR card assigned" empty state in the popup when `uniqueId` is missing.

### Out of scope
- No changes to the scanner, DB, or RLS.
- No new columns; purely wiring the correct field through the existing data flow.
