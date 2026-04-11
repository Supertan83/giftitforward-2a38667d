

## Fix Wrongly-Assigned Volunteer Check-ins

### What happened
3 volunteers were scanned today but their check-in landed on the old "Dry Run Friday Marketplace" (which is `completed`) instead of today's active "Women Community Workers Marketplace - Morning Event". They show as `checked_in` but on the wrong marketplace, so the admin view for today's event shows them as inactive.

### Fix (immediate data correction + attendance records)

**1. Create a one-time fix edge function** (`supabase/functions/fix-volunteer-marketplace/index.ts`)

This function will:
- UPDATE the 3 volunteer_qr_cards to point `marketplace_id` to the Morning Event (`f06dc413-2953-469f-9e07-cb9fddac9bba`)
- UPDATE or INSERT matching `volunteer_attendance` records to reference the correct marketplace
- Return a summary of what was fixed

**2. Deploy and invoke it** to apply the fix immediately

**3. Delete the function** after use (it's a one-time fix)

### Prevents future recurrence
The root cause is that when volunteers scan in, the system uses whatever marketplace was last associated with their card. If a volunteer's card still points to an old marketplace and the scanner doesn't explicitly set the new one, it stays wrong.

No code changes needed beyond the one-time data fix — the VolunteerZone check-in flow already assigns the selected marketplace. The issue was an operational one (wrong marketplace was still `active` when these 3 were scanned early this morning).

### Summary
| Step | Action |
|---|---|
| Create edge function | One-time UPDATE for 3 cards + attendance |
| Deploy & call | Fix applied in seconds |
| Clean up | Delete the function |

