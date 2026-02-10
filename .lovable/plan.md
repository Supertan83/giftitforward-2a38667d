

## Fix Marketplace Count: Fetch All 27 from Surpluss API and Clean Up Test Data

### Problem
- The Surpluss platform has **27 marketplaces** (excluding test ones)
- Locally, there are only **23 marketplaces** (22 linked + 1 unlinked), and **2 of those are test entries** ("Tala's Marketplace" and "Lea's Marketplace")
- The Surpluss API endpoint `/api/common/marketplace-events` currently returns only **20 events** -- likely because it has default filters or pagination behavior that excludes some

### Root Cause
The `autoLinkMarketplaces` function in the edge function fetches from `/api/common/marketplace-events?page=1&limit=100` and only gets 20 results. The remaining 7+ marketplace events on Surpluss are not being returned, possibly due to:
1. The API returning only "active" or "published" events by default
2. Additional query parameters needed (e.g., `status=all`, `include_completed=true`, or `include_all=true`)

### Plan

#### Step 1: Create a dedicated edge function to fetch and import ALL Surpluss marketplace events
Build a new edge function `fetch-surpluss-marketplaces` that:
- Calls the Surpluss API `/api/common/marketplace-events` with broader parameters (try `?page=1&limit=200&status=all` and similar variations)
- Returns the full raw list of marketplace events from Surpluss so we can see exactly what's available
- For each Surpluss event NOT already in the local database (matched by `external_id`), creates a new `marketplace_events` record with:
  - `name` from the Surpluss event title
  - `external_id` from the Surpluss event ID
  - `status` set to "upcoming"

#### Step 2: Clean up test marketplaces
- Remove "Tala's Marketplace" (external_id: 35) and "Lea's Marketplace" (external_id: 68) from the local database, as these are test entries that don't correspond to real events
- Also clean up any associated `marketplace_item_allocations` for these test entries

#### Step 3: Update the sync edge function to be more aggressive with fetching
Modify `sync-surpluss-event-allocations/index.ts`:
- In the `autoLinkMarketplaces` function, try additional API parameter variations to capture all events (e.g., adding `status=all` or fetching without filters)
- If the API truly only returns 20, add a fallback: for any Surpluss event found, if no local marketplace exists with that `external_id`, **auto-create** it (not just auto-link by name)

#### Step 4: Add a "Fetch All Marketplaces" button to the Sync Monitor UI
Update `SurplussSyncMonitor.tsx`:
- Add a button to trigger the new edge function, allowing admins to manually pull all marketplace events from Surpluss
- Show a summary of how many new marketplaces were discovered and created

### Technical Details

**New file:** `supabase/functions/fetch-surpluss-marketplaces/index.ts`
- Fetches all pages from `/api/common/marketplace-events`
- Cross-references with local `marketplace_events` table by `external_id`
- Auto-creates missing local entries
- Returns summary of what was found and created

**Modified file:** `supabase/functions/sync-surpluss-event-allocations/index.ts`
- Enhance `autoLinkMarketplaces` to also auto-create missing marketplace entries (not just link existing ones by name)
- Try query parameter variations to get more results from the API

**Modified file:** `src/components/admin/SurplussSyncMonitor.tsx`
- Add "Fetch All Marketplaces" button in the header area
- Show results toast with count of new vs existing marketplaces

**Database cleanup (migration):**
- Delete test marketplace allocations and entries for "Tala's Marketplace" and "Lea's Marketplace" (will confirm with user before executing)

