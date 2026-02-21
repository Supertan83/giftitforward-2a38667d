

# Add Attendance Certificates for Family Members

## Problem
When a volunteer is checked out, they receive a survey email and can get an attendance certificate. However, family members (who have their own QR cards with `-F1`, `-F2` suffixes) share the same volunteer record and don't have individual email addresses. When family member cards are checked out, no certificate is generated or sent for them.

## Solution
When a volunteer card is checked out, automatically detect all family member cards for the same volunteer that are also checked in at the same marketplace, check them out together, and generate + send attendance certificates for each family member to the volunteer's email address.

## How It Works

1. **During volunteer checkout**: After checking out the main volunteer card, the system finds all sibling family cards (same `volunteer_id`, status `checked_in`) and checks them out too
2. **Certificate for each family member**: For each family member card, generate an attendance certificate using the family member's name (stored in `events_json` dependents or extracted from the card's metadata)
3. **Send all certificates in one email**: Bundle the family member certificates and send them to the volunteer's email, or send individual emails per family member

## Technical Changes

### 1. Update `checkOutVolunteer` mutation (`src/hooks/useSupabaseData.ts`)
- After checking out the scanned card, query for sibling family cards with the same `volunteer_id` that are `checked_in`
- Check out each family card (update status, calculate hours, update attendance records)
- Collect family member names from the card unique IDs and the volunteer's `events_json` dependents data
- For each family member, invoke `send-certificate` with `certificateType: 'attendance'` using the family member's name and the volunteer's email

### 2. Update `send-certificate` edge function (`supabase/functions/send-certificate/index.ts`)
- Add support for a `isFamilyMember: true` flag to slightly customize the email wording (e.g., "Family Member Attendance Certificate")
- No other structural changes needed -- the function already accepts `firstName`, `lastName`, `email`, and `certificateType`

### 3. Map family card IDs to names
- Family cards have IDs like `VOL-XXXX-F1ABCD` where the suffix indicates family member index
- The volunteer's `pending_volunteers.events_json` contains a `dependents` array with names and types
- Match family card index to dependent name using the existing `extractUniqueDependents` pattern from `VolunteerQRCardsViewer.tsx`
- If no name mapping is found, fall back to "Family Member 1", "Family Member 2", etc.

### 4. Track certificate status for family cards
- Update the `volunteer_qr_cards` table's existing `survey_completed_at` field for family cards when their certificate is generated
- This prevents duplicate certificate generation on re-checkout

## Flow Summary

```text
Volunteer scans out (card VOL-1234)
  |
  +--> Check out volunteer card
  +--> Send survey email to volunteer
  +--> Find family cards: VOL-1234-F1XX, VOL-1234-F2XX (status: checked_in)
       |
       +--> Check out each family card
       +--> Generate attendance certificate PDF for each family member name
       +--> Send certificate email(s) to volunteer's email address
```

## What the Volunteer Receives
- 1 survey email (existing behavior, unchanged)
- 1 certificate email per family member, each with a personalized PDF using the family member's name, sent to the volunteer's email

