

# Consolidate Resend Actions into a Mail Popover Menu

## What
Replace the separate Mail (welcome) and Send (survey) icon buttons with a single Mail icon button that opens a popover/dropdown menu containing all email-related actions:
- **Resend Welcome Email**
- **Resend Survey**
- **Resend Certificate** (opens the existing certificate preview dialog)

This declutters the action buttons row and groups related functionality logically.

## Changes

### File: `src/components/admin/PendingVolunteers.tsx`

1. **Import `DropdownMenu`** components (already available in `@/components/ui/dropdown-menu`)

2. **Replace the 3 action buttons** (Resend Survey at lines 1836-1856, Resend Welcome Email at lines 1857-1874, and the Award/Certificates button at lines 1798-1813) with:
   - Keep the **Award** button as-is (viewing certificates is distinct from emailing)
   - Replace the **Mail** and **Send** buttons with a single `DropdownMenu` triggered by a Mail icon button
   - The dropdown contains 3 items:
     - "Resend Welcome Email" — triggers existing `resendEmailMutation.mutate(volunteer.id)`
     - "Resend Survey" — triggers existing `resendSurveyMutation.mutate(volunteer)` (disabled if no QR card)
     - "Resend Certificate" — opens the existing certificate preview dialog (`setCertificatePreviewVolunteer` + `setShowCertificatePreview`)

3. **Result:** Action buttons simplify from `[Eye] [Award] [Send] [Key] [Mail] [Trash]` to `[Eye] [Award] [Mail ▾] [Key] [Trash]`

The dropdown menu items will show loading spinners inline when their respective mutations are pending. No new mutations or backend changes needed — all functions already exist.

