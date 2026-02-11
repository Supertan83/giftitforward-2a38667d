

## Remove external_id Requirement for Surpluss Sync

### Problem
The "Send to Surpluss" button only appears when a marketplace has an `external_id`. Surpluss confirmed they don't use `external_id` -- it was a GIF-internal concept. This means most marketplaces can't sync because they lack an `external_id`.

### Changes

**1. UI: Show "Send to Surpluss" for ALL marketplaces** (`src/components/admin/MarketplaceReports.tsx`)
- Remove the `selectedMp?.external_id` condition on line 176 so the button appears for every marketplace
- The button will always be visible regardless of whether `external_id` is set

**2. Edge function: Use marketplace name instead of external_id** (`supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts`)
- Remove the check that requires `external_id` (lines 46-50)
- For the demographics PUT request, search the Surpluss API by marketplace **name** instead of using `external_id` in the URL path
- Strategy: First call `GET /api/common/marketplace-events` to find a matching event by name, then use that Surpluss-side ID for the PUT call
- If no matching event is found by name, log a clear error: "No matching Surpluss event found for marketplace: [name]"

**3. Edge function: Update volunteer POST to include marketplace name** (`supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts`)
- Include the marketplace name in the volunteer payload so Surpluss can associate volunteers with the correct event on their side

### Technical Flow

```text
1. User clicks "Send to Surpluss"
2. Edge function receives marketplace_id
3. Fetches marketplace record from DB (gets name)
4. Calls GET /api/common/marketplace-events to find matching Surpluss event by name
5. If found: uses that Surpluss event ID for demographics PUT
6. If not found: returns clear error message
7. Sends volunteers via POST /api/common/volunteers (unchanged)
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/MarketplaceReports.tsx` | Remove `external_id` guard on Send to Surpluss button |
| `supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts` | Look up Surpluss event by name instead of using `external_id` |

