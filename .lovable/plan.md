

## Fix: Volunteer Hours Sync Sending Wrong Hours to Surpluss

### Problem
When syncing volunteer hours to Surpluss, the code fetches all attendance records for a volunteer's QR card regardless of marketplace. Marc Daly's card was used at two different marketplaces (4.02h at "Stronger Together" + 8.71h at "She Thrives"), but the sync sums both (12.73h) and sends that total to the "She Thrives" marketplace on Surpluss. The correct value should be 8.71h.

**Root cause:** In `sync-surpluss-volunteer-beneficiary/index.ts` (lines 524-527), attendance records are fetched using only `volunteer_card_id IN (...)` without also filtering by `marketplace_id`. This means hours from other marketplaces leak into the total.

### Solution

**File: `supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts`**

Add a `.eq('marketplace_id', mpId)` filter to the volunteer_attendance query (line 526) so only attendance records for the current marketplace are included in the hours calculation.

```text
Current (line 524-527):
  .from("volunteer_attendance")
  .select("volunteer_card_id, hours_worked")
  .in("volunteer_card_id", cardIds);

Fixed:
  .from("volunteer_attendance")
  .select("volunteer_card_id, hours_worked")
  .in("volunteer_card_id", cardIds)
  .eq("marketplace_id", mpId);
```

This single-line change ensures each marketplace only gets its own attendance hours, matching what the Marketplace Reports UI already shows.

### Fallback Logic Impact
The fallback from `total_hours_worked` (on the card) also has the same issue — it's the cumulative total across all marketplaces. With the attendance filter fix, the attendance sum will be correct per-marketplace. The fallback (`fromCard`) should only be used when there are zero attendance records for that marketplace, which would correctly return 0 in that case. No additional changes needed.

