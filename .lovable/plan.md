

## Fix: Stop Duplicate Marketplace Creation

### Problem
When you click "Fetch All Marketplaces" or "Sync All Now", the system creates new marketplace records for Surpluss API events instead of matching them to your existing records. This happens because:
- 8 manually-added events have no `external_id`
- The fetch function only checks `external_id` to detect duplicates, not names
- Both functions auto-create records without checking for name matches first

### Current State
- 38 marketplace records (should be 29)
- 9 duplicates caused by Surpluss events being created alongside existing name-matched records
- Multiple records with duplicate `external_id` values (e.g., Hard Hat Heroes March 1 has both ext_id 7 and 14)

### Plan

**Step 1: Data Cleanup**
Run SQL to:
- Delete the 9 duplicate records (those with NULL `external_id` that have a name-matched counterpart with an `external_id`, plus duplicate `external_id` entries like 27/29 and 9/25 etc.)
- Verify final count is 29

**Step 2: Fix `fetch-surpluss-marketplaces` edge function**
Before creating a new marketplace for a Surpluss event, add fuzzy name matching against all existing local marketplaces (not just those with `external_id`). If a name match is found:
- Update the existing record's `external_id` instead of inserting a new row
- Add it to `existingExternalIds` to prevent further duplicates

**Step 3: Fix `sync-surpluss-event-allocations` auto-link function**
Remove the "auto-create" block (lines 144-163) that creates new marketplace records for unmatched Surpluss events. The `fetch-surpluss-marketplaces` function already handles discovery -- the sync function should only link and sync, not create.

**Step 4: Deploy both updated edge functions**

### Technical Details

The name matching will reuse the same `normalizeName` + `namesMatch` pattern already in `sync-surpluss-event-allocations`:

```text
normalizeName("Stronger Together Emirati Family Community Marketplace February 21")
  => "stronger together emirati family community marketplace february 21"

normalizeName("Stronger Together Emirati Family Community Marketplace   February 21")  
  => "stronger together emirati family community marketplace february 21"

Result: Match found, update external_id on existing record instead of creating new one
```

In `fetch-surpluss-marketplaces`, the key change replaces:
```text
Current: Check external_id only -> if not found, INSERT new record
Fixed:   Check external_id -> if not found, fuzzy match name -> if match, UPDATE external_id -> if no match, INSERT new record
```

In `sync-surpluss-event-allocations`, the auto-create block (lines 144-163) will be removed entirely since marketplace discovery is handled by the dedicated fetch function.
