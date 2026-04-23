

## Plan: Show bulk-uploaded volunteers in the Partner Volunteers tab as well

### Current behavior

In `PendingVolunteers.tsx` the "Volunteers Added" view has two main tabs:

- **Partner Volunteers** (`approved`) → shows ONLY rows where `source` is null or `source != 'bulk_upload'`
- **Bulk Uploaded** (`bulk_uploaded`) → shows ONLY rows where `source = 'bulk_upload'`

Filtering happens in two places:
1. Client-side filter (lines 309–316): `result.filter(v => !v.source || v.source !== 'bulk_upload')` for the Partner tab.
2. Server-side `.or('source.is.null,source.neq.bulk_upload')` in the count/pagination query (line 1107).

So today bulk-uploaded volunteers are **invisible** from the Partner Volunteers tab.

### Desired behavior

- **Partner Volunteers tab** = ALL approved volunteers (partner + bulk-uploaded together), so admins have a single combined "all approved" list.
- **Bulk Uploaded tab** = unchanged — keeps showing only `source = 'bulk_upload'` for focused bulk management.
- Counts, pagination, search, event filter, and bulk actions continue to work in both tabs.

### Changes (single file: `src/components/admin/PendingVolunteers.tsx`)

1. **Client-side filter (~lines 309–316)**  
   Remove the `source != 'bulk_upload'` exclusion on the `approved` tab. Keep the bulk filter for the `bulk_uploaded` tab only:
   ```ts
   if (!isSearching && activeTab === 'bulk_uploaded') {
     result = result.filter(v => v.source === 'bulk_upload');
   }
   // approved tab: no source filter — show everything approved
   ```

2. **Server-side query (~lines 1102–1108)**  
   Drop the `.or('source.is.null,source.neq.bulk_upload')` branch for the approved tab so the paginated query returns all approved rows:
   ```ts
   if (activeTab === 'bulk_uploaded') {
     query = query.eq('source', 'bulk_upload');
   }
   // approved: no extra source filter
   ```

3. **Visual indicator (small UX add)**  
   In the row rendering for the Partner Volunteers tab, when a row has `source === 'bulk_upload'`, show a small `Bulk` badge next to the name so admins can still tell at a glance which entries came from a bulk upload. The existing `Bulk Uploaded` tab still gives a filtered view.

4. **Counts** — no change needed. `bulkUploadedCount` and the existing approved count already query independently.

### Out of scope

- `PartnerRegistrations.tsx` (the "Dubai Holdings Registrations" view) reads from a different table (`partner_registrations`) — that's the raw form-submission feed, not the volunteers list. No change there.
- No DB or edge function changes — pure UI filter adjustment.

### Result

- "Partner Volunteers" tab → unified list of ALL approved volunteers (partner submissions + bulk uploads), with a small "Bulk" badge on bulk-origin rows.
- "Bulk Uploaded" tab → still a focused view of bulk-only entries.
- Search, event filter, pagination, and bulk-action selection behavior preserved.

