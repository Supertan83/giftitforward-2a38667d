

# Fix Family Attendance, Visibility, and Export Issues

## Problem Summary

Three related issues with family member handling were raised by the operations team:

1. **Inflated attendance**: When a primary volunteer checks out, all their family members are automatically checked out too -- even if they never actually attended. This inflates headcounts in reports.
2. **No dedicated family view**: Family relationships are hard to see at a glance. The recently added expandable rows help, but the team wants a dedicated "Family Members" tab.
3. **Exports exclude family members**: The volunteer export only includes primary volunteers from `pending_volunteers`. Family member names, their attendance status, and certificate status are missing.

---

## Solution

### 1. Decouple Family Auto-Checkout

**File: `src/hooks/useSupabaseData.ts` (lines 1541-1677)**

Remove the automatic checkout of family cards when the primary volunteer checks out. The current block labeled `FAMILY MEMBER AUTO-CHECKOUT & CERTIFICATES` finds all sibling `-F` cards with `checked_in` status and checks them out + sends certificates.

**Change**: Remove the auto-checkout and auto-certificate logic for family cards entirely. Family members will need to be checked out individually (via the same QR scan process used for primary volunteers), ensuring only those who actually attended get recorded.

Keep the certificate-sending logic available separately -- certificates for family members can still be sent manually via the existing "Send Family Certs" dialog in the admin panel.

### 2. Add a "Family Members" Tab in Volunteers Added Section

**File: `src/components/admin/PendingVolunteers.tsx`**

Add a new tab called **"Family Members"** alongside the existing tabs (Partner, Bulk, Duplicates, Missing Email). This tab will:

- Query `volunteer_qr_cards` for all cards with `-F` suffix patterns
- Join with `pending_volunteers` (via `volunteer_id`) to resolve the primary volunteer's name
- Display a table with columns:
  - Family Member Name (resolved from `events_json` dependents)
  - Primary Volunteer Name
  - QR Card ID
  - Marketplace (from linked marketplace event)
  - Status (inactive / checked_in / checked_out)
  - Certificate Status (Sent / Not Sent)
  - Actions (preview certificate)
- Include search filtering by name or QR ID
- Include marketplace filter dropdown

### 3. Include Family Members in Export

**File: `src/components/admin/PendingVolunteers.tsx` (export handler, lines 932-1086)**

Extend the export logic to include family members as additional rows after each primary volunteer:

- After fetching primary volunteers, also fetch their linked `volunteer_qr_cards` with `-F` suffix
- For each primary volunteer with family cards, add extra rows with:
  - Full Name: resolved family member name
  - Email: primary volunteer's email (marked as "via [primary name]")
  - Type: "Family Member"
  - QR Card ID
  - Attendance Status: checked_in / checked_out / inactive
  - Certificate Sent: Yes / No
- Add a new "Type" column to differentiate "Primary" vs "Family Member" rows
- Add summary counts at the bottom: Total Registrations, Primary Volunteers, Family Members, Actual Attendance (only checked_out)

---

## Technical Details

### File Changes

1. **`src/hooks/useSupabaseData.ts`**
   - Remove the `FAMILY MEMBER AUTO-CHECKOUT & CERTIFICATES` block (lines 1541-1677)
   - Keep the rest of the `checkoutVolunteerCard` mutation intact (survey sending, primary card checkout, attendance record update)

2. **`src/components/admin/PendingVolunteers.tsx`**
   - Add a `family_members` value to the tab system
   - Add a new query for family QR cards with volunteer resolution
   - Add a `FamilyMembersTab` rendering section with table, search, and filters
   - Extend the export handler to fetch and append family member rows
   - Add "Type" column to export headers
   - Add summary row at the end of exports

### Data Flow for Family Members Tab

```text
volunteer_qr_cards (where unique_id LIKE '%-F%')
  --> join volunteer_id to pending_volunteers.id
  --> resolve member name from pending_volunteers.events_json dependents
  --> display in table with status and certificate info
```

### Export Enhancement

```text
Current:  [Primary Volunteer rows only]
Enhanced: [Primary Volunteer row]
          [  Family Member 1 row]
          [  Family Member 2 row]
          [Primary Volunteer row]
          ...
          [Summary: X total, Y primary, Z family, W attended]
```
