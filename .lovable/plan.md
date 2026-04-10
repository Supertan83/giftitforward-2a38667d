

## Fix: Marketplace External IDs Are Swapped — Items Landing in Wrong Marketplace

### What Happened

The Surpluss sync created 51 item allocations (36,662 total qty) and placed them in **"Mens Aviation Workers Marketplace - Morning Event"** (`3f44eb86`), but these items actually belong to **"Mens Construction Facility Workers Marketplace - Morning Event"** (`6ed111b0`).

The root cause: during the initial auto-link/sync, the `external_id` values were assigned before the correct marketplace names existed (or the fuzzy name matching confused "Construction" and "Aviation" since they share many words like "Mens", "Workers", "Marketplace", "Morning Event"). The sync log confirms `external_id: 33` was used to sync data into the Aviation marketplace instead of Construction.

Additionally, `external_id = 35` is assigned to TWO marketplaces ("Dry Run Friday" and "Aviation Morning"), which will cause future sync conflicts.

### Current (Wrong) State

| Marketplace | external_id | Has Allocations? |
|---|---|---|
| Mens Construction Morning | 33 | 0 items (should have ~37K) |
| Mens Construction Afternoon | 34 | 0 items |
| Mens Aviation Morning | 35 (duplicate!) | 51 allocations, 36,662 qty (wrong!) |
| Dry Run Friday | 35 (duplicate!) | 1 allocation |
| Mens Aviation Afternoon | 36 | 0 items |

### Fix Plan

**Step 1 — Move all 51 allocations from Aviation Morning to Construction Morning**

```sql
UPDATE marketplace_item_allocations
SET marketplace_id = '6ed111b0-f003-46e8-a719-d76cc1800431'
WHERE marketplace_id = '3f44eb86-f1c5-48a4-8bf3-5b70b41c5bfd';
```

This moves the 36,662 items to the correct Construction marketplace without losing any data.

**Step 2 — Fix the duplicate external_id = 35**

Remove `external_id` from "Dry Run Friday Marketplace" (it's an old test marketplace that shouldn't be linked to a current Surpluss event):

```sql
UPDATE marketplace_events
SET external_id = NULL
WHERE id = 'd21fba59-2bf2-4a47-bd10-f88278d4c95e';
```

**Step 3 — Verify correct external_id assignments**

After the fix, we need to confirm that the Surpluss event IDs (33, 34, 35, 36) match the correct marketplace names on the Surpluss platform. I'll call the Surpluss API via the edge function to verify the event-to-name mapping and correct any remaining mismatches.

### Summary

| Action | Type |
|---|---|
| Move 51 allocations from Aviation to Construction marketplace | Database fix |
| Remove duplicate `external_id = 35` from Dry Run marketplace | Database fix |
| Verify Surpluss event ID → name mapping via API | Verification |

No code changes needed — this is a data correction caused by incorrect auto-linking.

