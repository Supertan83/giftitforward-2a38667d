

# Generate Missing Family Member QR Cards

## Problem
Some volunteers registered via webhook have family members listed in their `events_json` (with `dependents` data), but no corresponding family QR cards were created in `volunteer_qr_cards`. This affects at least 7 volunteers (e.g., souheil.alaimi@alshaya.com who has dependent "Farah Zitouni" but only 1 QR card for themselves).

This happened because these volunteers were processed before the family QR generation logic was added to the webhook-receiver.

## Solution

### 1. New Edge Function: `generate-missing-family-qrs`
Create a backend function that:
- Fetches all `pending_volunteers` with `events_json` containing dependents
- For each, checks if family QR cards already exist (by counting cards with `-F` suffix linked to that volunteer)
- If dependents exist but family cards are missing, generates the family QR cards using the same naming convention (`VOL-XXXXX-F1XX`, `-F2XX`, etc.)
- Returns a summary of what was created

### 2. Admin UI: Add "Fix Missing Family QR Cards" button
In the `PendingVolunteers.tsx` component (Volunteers Added section), add a utility button that:
- Calls the new edge function
- Shows a toast with results (how many family cards were generated)
- Placed near the existing bulk action buttons for admin convenience

## Technical Details

**Edge Function** (`supabase/functions/generate-missing-family-qrs/index.ts`):
- Reuses the same `extractUniqueDependents` logic from webhook-receiver
- Reuses the same `generateFamilyQRId` pattern (base volunteer QR + `-F{index}{random}`)
- For each volunteer: count existing family cards vs expected dependents; generate only the missing ones
- Inserts new cards into `volunteer_qr_cards` with `status: 'inactive'` and linked `volunteer_id`

**Frontend** (`src/components/admin/PendingVolunteers.tsx`):
- Add a "Generate Missing Family QRs" button with a Users icon
- On click, invoke the edge function and display results via toast
- Include count of affected volunteers and cards created

