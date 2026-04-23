

## Yes — there's a hidden 1,000-row display limit (volunteers are NOT blocked)

### What's actually happening

- The database has **1,030 approved volunteers** today (confirmed via live query).
- New signups, bulk uploads and partner registrations **continue to be saved** with no limit. Nothing in the code or database caps how many volunteers can exist.
- The "1,000" you're seeing is a **Supabase/PostgREST default response cap**: any `SELECT` without explicit pagination silently returns at most 1,000 rows. Several places in the app fetch volunteers without paginating, so once we cross 1,000 the extra rows simply don't appear in the UI.

### Where the 1,000-row truncation happens today

| # | File | What it loads | Impact when >1,000 approved volunteers |
|---|---|---|---|
| 1 | `src/components/admin/PendingVolunteers.tsx` line ~246 (main list query) | All approved volunteers for the "Volunteers Added" view | Newest 1,000 shown, oldest hidden |
| 2 | `src/components/admin/PendingVolunteers.tsx` line ~1090 (CSV export) | Approved volunteers for export | Export missing rows beyond 1,000 |
| 3 | `src/hooks/useVolunteerDetails.ts` line ~32 | Stats per marketplace (registered / attended / dropout / categories) | Counts under-report |
| 4 | `src/components/admin/EmailCampaignManager.tsx` (4 queries around lines 173–230) | Recipient lists for "all volunteers", "by marketplace", "pending training" | Campaigns silently skip volunteers beyond 1,000 |
| 5 | `src/hooks/useVolunteerDetails.ts` line ~87 — `registration_events.limit(1000)` | Family-member totals across all marketplaces | Family count under-reports as registrations grow |

### The fix (paginated range fetching, no DB changes)

Apply the same range-loop pattern already memorised for this project (`mem://constraints/data-retrieval-pagination-at-scale`) in each location above:

```ts
async function fetchAllRows(buildQuery, pageSize = 1000) {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
```

Apply it to the 5 query sites listed above so they keep paging until all rows are returned. The main list query in `PendingVolunteers.tsx` will use the same helper but capped to the currently active filter (status / source / search) so it stays fast.

### Out of scope

- No DB schema changes, no RLS changes, no new tables.
- No edge function changes — `bulk-create-volunteers` is unaffected (it never reads the full list, only inserts).
- The "Bulk Uploaded" tab and per-row badges added previously stay untouched.

### Result

- Volunteers are **never blocked** from registering — that was never a real cap, only a display/count cap.
- All approved volunteers (current 1,030 and any future growth) appear in the Volunteers Added list.
- CSV exports include every matching row.
- Volunteer-details stats and email campaigns count/target the full population, not just the first 1,000.

