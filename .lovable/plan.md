

# Fix Family Sub-Row: Add Eye Icon and Fix Badge Position

## What's Wrong

Looking at the screenshot, two issues in the family member sub-rows under each volunteer:

1. **Missing eye icon**: There's no way to preview a family member's certificate from the sub-row. The user wants an eye icon (similar to the volunteer row's certificate preview icon) so they can view the family member's attendance certificate.

2. **"Not Sent" badge misaligned**: The certificate status badge ("Not Sent" / "Cert Sent") is not aligned under the correct column. It appears shifted because the sub-row table cells don't match the parent row's column structure (9 columns: Checkbox, Name, Email, Company, Family, Events, Submitted, Email Status, Actions).

## The Fix

### 1. Fix column alignment in family sub-rows

Restructure the sub-row cells to align properly with the 9-column parent table:
- Cell 1 (Checkbox): empty
- Cell 2 (Name): family member name with user icon, indented
- Cell 3 (Email): QR code ID in mono font
- Cell 4 (Company, hidden md): empty
- Cell 5 (Family, hidden lg): empty
- Cell 6 (Events, hidden lg): empty
- Cell 7 (Submitted, hidden sm): certificate status badge ("Cert Sent" or "Not Sent") -- moves badge to a visible, aligned column
- Cell 8 (Email Status, hidden md): empty
- Cell 9 (Actions): eye icon button to preview the family member's certificate

### 2. Add eye icon for certificate preview

In the Actions cell of each family sub-row, add an eye icon button that opens the `CertificatePreviewDialog` with the family member's resolved name (split into first/last) and their certificate status.

## Technical Details

### File: `src/components/admin/PendingVolunteers.tsx`

**Lines 1751-1779** (the sub-row rendering): Replace the current cell layout with properly aligned cells matching the parent columns, and add an eye icon button in the last cell that sets `certificatePreviewVolunteer` to a temporary object with the family member's name.

Since `CertificatePreviewDialog` expects `firstName` and `lastName` props, the eye icon click handler will split the resolved `memberName` into first/last name parts and set a synthetic preview object.

