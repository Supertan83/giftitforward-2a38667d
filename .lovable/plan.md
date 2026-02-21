

# Enhanced Family Members Detail View in Send Family Certs Dialog

## Problem
The current dialog only shows a summary badge like "1 Pending / 1 Sent" per volunteer. The user wants to see each individual family member listed with their name and attendance/certificate status (inactive, checked in, checked out, certificate sent).

## Solution
Expand the table to show each family member as a sub-row under their volunteer, with individual status indicators and per-member send buttons.

## Changes

### File: `src/components/admin/PendingVolunteers.tsx`

1. **Update the query** to fetch ALL family cards for the volunteer (not just `checked_out` ones for the selected marketplace). Include cards with any status and any marketplace (including null) so we can show the full picture.

2. **Redesign the table layout** to an expandable/nested view:
   - Volunteer row shows name, email, and overall summary
   - Below each volunteer, list each family member with:
     - **Name**: Mapped from `events_json` dependents (e.g., `-F1` maps to first dependent)
     - **QR Code**: The `unique_id` of their card
     - **Status badge**: Shows the card's current state:
       - "Inactive" (grey) -- card exists but never used
       - "Checked In" (blue) -- currently at marketplace
       - "Checked Out" (green) -- attended and left
       - "Cert Sent" (purple) -- certificate already delivered
     - **Send button**: Only enabled for cards that are `checked_out` and have no `survey_completed_at`

3. **Filter logic**: When a marketplace is selected, show volunteers who have ANY family cards associated with that marketplace. Also show family cards with no marketplace (as "Not Assigned") so admins see the full picture.

4. **Individual send**: Keep per-family-member certificate sending, but now each row has its own button rather than a bulk button per volunteer.

### Visual Layout

```text
+------------------+-------------------------+---------------+-----------+--------+
| Family Member    | QR Code                 | Status        | Cert      | Action |
+------------------+-------------------------+---------------+-----------+--------+
| Volunteer: Arish Shrestha (nyx.bas-uae@alshaya.com)                             |
+------------------+-------------------------+---------------+-----------+--------+
| [dep name from   | VOL-ML0L423B-4GQR-F13X  | Checked Out   | Sent      |   --   |
|  events_json]    |                         |               |           |        |
+------------------+-------------------------+---------------+-----------+--------+
| [dep name 2]     | VOL-ML0L423B-4GQR-F2X1  | Inactive      | --        |   --   |
+------------------+-------------------------+---------------+-----------+--------+
```

### Status Badge Colors
- **Inactive**: `variant="outline"` (grey)
- **Checked In**: `className="bg-blue-100 text-blue-800"`
- **Checked Out**: `className="bg-green-100 text-green-800"`
- **Cert Sent**: `variant="secondary"` (indicates completed)

### Key Technical Details
- Extract dependent names from `events_json` using the existing `extractUniqueDependents` helper
- Map family card suffix (`-F1`, `-F2`, etc.) to dependent index to get names
- Change the query from `.eq('status', 'checked_out')` to remove that filter, so all family cards for the marketplace appear
- Also include cards with `marketplace_id IS NULL` that belong to the same volunteer, shown as "Not Assigned"
- Disable the "Send" button for cards that are not `checked_out` or already have `survey_completed_at`
