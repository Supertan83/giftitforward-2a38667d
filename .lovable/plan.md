## Diagnosis

I queried Surpluss directly for event 49 (Inclusive Community: Family and People of Determination Marketplace Afternoon Event) and compared to GIF.

**Surpluss `/donation-allocations`** returns 62 unique materials totaling **32,337**. The endpoint returns 1 allocation container with all 62 materials inside `allocated_materials`. Some materials appear as duplicate rows on the Tractor admin (e.g. material #799 Women's Clothing = 1392+1392=2784, material #990 Toys = 130+785=915), but the API itself already aggregates them.

**GIF DB before re-sync:** 30,945 across 62 rows. Material #799 was stored as **1,392** instead of 2,784, and material #974 / #990 were partially off — accounting for the missing 1,392.

**Root cause:** A previous sync run stored only one copy of the duplicated material rows (the materialMap aggregation in `sync-surpluss-event-allocations` was added later). The 30,945 figure is **stale data** left behind by that earlier partial sync. The current sync code aggregates correctly.

**Verification:** I just ran the sync function once and the DB total is now exactly **32,337** across the same 62 materials, matching Surpluss perfectly:
- #799 Women clothing → 2,784 ✓
- #990 Toys → 915 ✓
- #974 Toys → 234 ✓

## Plan

No code changes needed — the bug is already fixed in the current sync function. You just need to:

1. **Refresh the GIF Item Allocation page** for this marketplace. The "Total Quantity" tile should now read **32,337**, matching the Surpluss "Allocated 32,337" badge.
2. The 62 material rows are now in sync; allocated values for #799, #990, #974 are correct.

## Optional follow-up (recommend)

If you want to be sure no other marketplace has stale partial-aggregation data left over from before the fix, I can run the "Sync All" once across every linked marketplace. That will re-aggregate every event in one pass and surface any other mismatches. Let me know if you want me to do that.

## Technical notes

- Surpluss `/api/common/donation-allocations?event_id=49` returns 1 container, 62 materials, sum = 32,337.
- `materialMap` in `supabase/functions/sync-surpluss-event-allocations/index.ts` (lines ~268-330) sums duplicates by `material_id` before upserting — this is correct.
- Pre-fix DB rows were just outdated; re-running the sync overwrote them with the correct totals.
