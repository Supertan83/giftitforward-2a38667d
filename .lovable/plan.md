

# Add Ahlam's Family Members to Feb 22 Event

## Current State

- **March 5 event (index 8)**: Already has the 3 dependents (Muna, Ghazlan, Al Hanoof) -- will remain unchanged
- **Feb 22 event (index 2)**: Shows `family-members-joining: No`, 0 dependents -- needs update
- **Family cards (F1, F2, F3)**: No `marketplace_id` set -- need to be linked to Feb 22 marketplace

## What Will Be Done

Create a one-time edge function `fix-ahlam-family-event` that:

1. Copies the same 3 dependents into the Feb 22 event entry (index 2) in `events_json`, setting `family-members-joining: 'Yes'`, `number-of-adults: 3`, `total-attendees: 4`
2. Leaves the March 5 event entry completely untouched
3. Sets `marketplace_id` on all 3 family cards (F1, F2, F3) to the Feb 22 marketplace (`261089f4-3f30-46c4-a5d5-d666a4618df0`)

## Technical Details

| Detail | Value |
|--------|-------|
| File | `supabase/functions/fix-ahlam-family-event/index.ts` |
| Volunteer ID | `71579f66-931f-4dc3-8f90-47a1b4a30ed6` |
| Feb 22 event index | 2 |
| Marketplace ID | `261089f4-3f30-46c4-a5d5-d666a4618df0` |
| Cards to update | `VOL-MKYLFGFF-AW95-F1`, `F2`, `F3` |

## Result

- Feb 22 event will show the 3 family members alongside the existing March 5 entry
- Family cards will be linked to the Feb 22 marketplace for proper certificate generation and reporting
- March 5 data stays exactly as it is
