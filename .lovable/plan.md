

# Fix "Send to Surpluss" — Volunteer & Demographics Sync

## Problems Identified

From the edge function logs, two critical issues are causing incorrect data:

### 1. Demographics never reach Surpluss
The function tries to match marketplace names via fuzzy string comparison against the Surpluss `/api/common/marketplace-events` endpoint. But the names don't match (e.g., "Young Dreamers Boys Community School Marketplace" has no counterpart in the 10 Surpluss events). **Meanwhile, every marketplace already has a correct `external_id` column** (e.g., `1` for Young Dreamers, `21` for Feb 21 marketplace) that maps directly to the Surpluss event ID — but it's never used.

### 2. ALL volunteers are synced, not per-marketplace
When clicking "Send to Surpluss" for a specific marketplace, the function fetches all 701 volunteers from `pending_volunteers` regardless. It should only send volunteers whose `events_list` or `events_json` matches the selected marketplace.

### 3. Volunteer event filtering is missing
Volunteers have `events_list` (comma-separated slugs) and `events_json` (structured array with event slugs). The sync should filter to only volunteers registered for the selected marketplace's event.

## Plan

### 1. Use `external_id` for Surpluss event matching (edge function)
Instead of fuzzy name matching against the `/api/common/marketplace-events` API, use the marketplace's `external_id` directly as the Surpluss event ID for the demographics PUT call. This eliminates the name mismatch problem entirely.

### 2. Filter volunteers by marketplace (edge function)
- Fetch the selected marketplace's name and slugify it
- Only send volunteers whose `events_list` contains a slug matching the selected marketplace
- This prevents sending all 701 volunteers when only a subset registered for the event

### 3. Update the hook to pass marketplace context
The hook currently passes `marketplace_id` correctly. No changes needed there.

## Files Changed

1. **Edit**: `supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts`
   - Replace fuzzy name matching with `external_id` lookup for demographics
   - Add volunteer filtering by marketplace using `events_list`/`events_json` matching
   - Remove the unnecessary `/api/common/marketplace-events` API call
   - Keep the volunteer create/bulk-update logic but scoped to filtered volunteers

