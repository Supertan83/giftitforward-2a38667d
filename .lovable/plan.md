

# Add Resend Survey & Certificate Buttons Per Volunteer in Admin

## Context
The admin "Volunteers Added" section already shows each approved volunteer with action buttons (View Details, View Certificates, Credentials, Resend Welcome Email, Delete). The request is to add two more action buttons per volunteer row: **Resend Survey** and **Resend Certificate**.

## Data Available
Each volunteer row already has:
- `volunteer.volunteer_qr_cards` — array of QR cards with `id`, `unique_id`, `status`, `checked_in_at`, `checked_out_at`, `survey_completed_at`
- `volunteer.first_name`, `volunteer.last_name`, `volunteer.email`
- From QR cards, we can derive the primary card's `id` (volunteerCardId) and the marketplace_id (from a separate lookup or from the card)

## Problem
- `send-survey` needs: `volunteerCardId`, `volunteerName`, `volunteerEmail`, optionally `volunteerId` and `marketplaceId`
- `send-certificate` needs: `firstName`, `lastName`, `email`, `certificateBase64`, `certificateType`, `marketplaceId` — the certificate PDF must be generated client-side first
- The volunteer QR card data is already joined in the query, but `marketplace_id` is not currently selected

## Changes

### 1. Update the volunteer QR cards select to include `marketplace_id`
**File:** `src/components/admin/PendingVolunteers.tsx`

Add `marketplace_id` to the `volunteer_qr_cards` select clause in the approved volunteers query (around line 952) and the family cards query (around line 1006). Also update the `VolunteerQRCard` interface to include `marketplace_id`.

### 2. Add "Resend Survey" button per volunteer row
**File:** `src/components/admin/PendingVolunteers.tsx`

Add a new mutation `resendSurveyMutation` that:
- Finds the primary (non-family) QR card from `volunteer.volunteer_qr_cards`
- Calls `supabase.functions.invoke('send-survey', { body: { volunteerCardId, volunteerName, volunteerEmail, marketplaceId } })`
- Shows toast on success/failure

Add a button with a `Send` icon in the action buttons area (between the existing Resend Email and Delete buttons), with tooltip "Resend Survey". Only enabled when the volunteer has at least one QR card.

### 3. Add "Resend Certificate" button per volunteer row
**File:** `src/components/admin/PendingVolunteers.tsx`

The certificate flow is more complex because it requires generating a PDF first. However, the existing "View Certificates" button already opens `CertificatePreviewDialog` which has send functionality built in. 

Instead of duplicating the certificate generation logic, add a quick-action button that opens the certificate preview dialog pre-set to the attendance certificate type, allowing the admin to send from there (this flow already exists).

**Simpler approach:** Add a dedicated "Send Survey" icon button. For certificates, the existing Award button already handles this — just ensure it's clearly labeled.

### 4. Summary of UI changes
In the actions `<TableCell>` for each approved volunteer row (around lines 1746-1838), add one new button after the Award (certificates) button:

```text
[Eye] [Award] [Send Survey] [KeyRound] [Mail] [Trash]
```

The Send Survey button will:
- Find primary QR card from `volunteer.volunteer_qr_cards`
- Call `send-survey` edge function
- Show loading state and toast feedback
- Be disabled if no QR card exists

## Files changed
1. `src/components/admin/PendingVolunteers.tsx` — add `marketplace_id` to QR card queries, add survey resend mutation, add Send Survey button per volunteer row

