## Goal

Make the "Send to Surpluss" button in the Marketplace Report send **only item distribution figures**. Skip the volunteer sync and beneficiary sync so manually entered volunteer/beneficiary data on Surpluss is not overwritten.

## Changes

### 1. `src/hooks/useSurplussVolunteerBeneficiarySync.ts`
- In `syncToSurpluss`, skip step 1 (`sync-surpluss-volunteer-beneficiary`) and step 2 (`sync-surpluss-beneficiaries`) entirely.
- Keep only step 3 (distribution reporting via `report-surpluss-distribution`), including the existing pre-flight allocation re-sync.
- Return the same `SyncResult` shape so `MarketplaceReports.tsx` doesn't break — volunteer/beneficiary counters return `0`, arrays empty.
- Simplify the success/failure toast to focus on distribution only (e.g. `Distribution: X/Y item(s) reported`).
- Update `STEP_LABELS` so the button shows `Reporting distribution…` instead of the 1/3, 2/3, 3/3 progression.

### 2. `src/components/admin/MarketplaceReports.tsx` (line ~894–909)
- Update the confirm dialog copy from "This will sync volunteers, beneficiaries, and distribution figures to Surpluss" to something like:  
  *"This will send only the item distribution figures to Surpluss. Volunteer and beneficiary data on Surpluss will not be modified."*
- No other UI changes; button label and handler stay the same.

## Out of scope
- No edge function changes — `sync-surpluss-volunteer-beneficiary` and `sync-surpluss-beneficiaries` remain available; they're just no longer invoked from this button.
- No DB changes.
- Other sync entry points (e.g. SurplussSyncPanel) are untouched.
