

# Fix: Remaining Broken Regex + Cleanup Excess Family Cards

## Problem Summary

The screenshot shows "Family of Ahlam AlHashemi" repeated 3 times in the marketplace report. This volunteer has **zero dependents** in her registration data, yet somehow has 3 family QR cards that were used (status: checked_out).

Two issues remain:

1. **Broken regex still exists in webhook-receiver** (lines 4780 and 4789): The manual "add family member" endpoint still uses the old buggy pattern `/-F\d+[A-Z0-9]+$/` which miscounts existing family cards when suffixes are all-numeric (e.g., `-F100`), causing duplicate card creation.

2. **The previous cleanup only deleted `inactive` cards** -- it skipped the `checked_out` ones. For volunteers with **zero dependents**, ALL family cards are erroneous and should be removed regardless of status.

Additionally, some volunteers have more family cards than dependents even after the first cleanup (e.g., Jaswinder Singh: 4 family cards, 2 dependents -- 2 new ones were created after the cleanup because the `generate-missing-family-qrs` was re-run).

## Plan

### 1. Fix the last broken regex in webhook-receiver (lines 4780 + 4789)

Replace `/-F\d+[A-Z0-9]+$/` with `/-F\d+/` in both occurrences. This is the same fix already applied elsewhere but missed in the manual "add family member" handler.

### 2. Update and re-run the cleanup function

Update `cleanup-duplicate-family-cards` to:
- Delete ALL family cards (any status) when a volunteer has 0 dependents
- Delete excess `inactive` OR `checked_out` family cards when the count exceeds the actual dependent count (keep earliest N cards)
- Still skip cards with `checked_in` status (actively in use today)

### 3. Deploy and execute

Deploy both updated functions, then run the cleanup to remove the remaining duplicates.

## Technical Details

### File: `supabase/functions/webhook-receiver/index.ts`

**Line 4780:** Change `!/-F\d+[A-Z0-9]+$/.test(c.unique_id)` to `!/-F\d+/.test(c.unique_id)`

**Line 4789:** Change `/-F\d+[A-Z0-9]+$/.test(c.unique_id)` to `/-F\d+/.test(c.unique_id)`

### File: `supabase/functions/cleanup-duplicate-family-cards/index.ts`

Update the deletion filter to include `checked_out` cards (not just `inactive`):

```text
// Before: only deleted inactive
const toDelete = excess.filter(c => c.status === 'inactive');

// After: delete inactive or checked_out (skip checked_in -- in active use)
const toDelete = excess.filter(c => c.status !== 'checked_in');
```

Also handle the zero-dependents case: if a volunteer has 0 dependents, ALL family cards are excess.

### Execution

1. Deploy both edge functions
2. Run cleanup with `dryRun: false`
3. Verify affected volunteers (Ahlam AlHashemi, Jaswinder Singh, etc.) now show correct card counts

## What Does Not Change

- Primary QR card creation
- Check-in/check-out flows
- Attendance records (only QR card records are cleaned)
- Report rendering logic (already handles name resolution correctly)

