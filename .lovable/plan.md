
## What's wrong

For "Mens Construction Facility Workers Marketplace Morning Event" (Surpluss event ID 33), GIF sends `Sync complete` but Tractor → Distribution Records → Volunteers shows the wrong (much smaller) number.

Audit log proves the bug:

```
sync_volunteer  → mp_event_id=33 → 500: "Volunteer with email X already exists"
sync_volunteer  → mp_event_id=33 → 500: "Volunteer with email Y already exists"
sync_volunteer  → mp_event_id=33 → 500: "Volunteer with email Z already exists"
bulk_update_volunteers → 200 OK
sync_volunteer_event_hours → 200 OK
```

Then the edge function **rewrites those 500s to `success=true`** in the audit log (lines 514–527 in `sync-surpluss-volunteer-beneficiary/index.ts`), the toast shows "Sync complete", and on Tractor those volunteers are never attached to event 33.

### Why it happens

Three independent bugs combine:

1. **"Already exists" path is mishandled.** When Surpluss returns 500 / "already exists", we mark it `skipped` and *don't* call bulk-update for that volunteer (the "previously synced" set is built only from local audit logs, not from Surpluss's truth). So the marketplace_event_id link is never sent for those volunteers.
2. **Bulk-update never receives `marketplace_event_id` for `previouslySyncedVolunteers`** unless the run itself was a single-marketplace run *and* the volunteer was already in the local audit log as a successful `sync_volunteer`. For volunteers that just got rejected as "already exists" in this same run, they are in `newVolunteers`, not `previouslySyncedVolunteers`, so they never reach bulk-update.
3. **`volunteer_hours` rows are skipped when `total_hours_worked = 0` and there's no attendance row** (line 764: `if (hours <= 0) continue;`). Volunteers who were never checked-in via the volunteer QR (most of them at this event — only 2 of 6 expected have cards) are simply omitted from the hours payload, so Tractor never gets a row tying them to event 33.

Net effect: only a tiny subset (the 2 with QR check-ins + maybe brand-new volunteers we created via POST) get attached to event 33 on Tractor. Everyone else stays unlinked → the Distribution Records volunteer count is wrong.

### Verified evidence

- 6 volunteers in our DB have `events_list` containing `mens-construction-facility-workers-marketplace---morning-event`.
- Only 2 have a `volunteer_qr_cards` row for that marketplace, both `checked_out`.
- Last 4 sync runs against event 33 produced **only** `500 already exists` responses for the new POSTs, then 200 for bulk-update and hours.
- `bulk_update_volunteers` payload only ever covers volunteers already in `surpluss_api_audit_log` as a successful `sync_volunteer` — not the 500-returning ones from the same run.

## Fix

### 1. Treat "already exists" as a successful sync and queue the volunteer for bulk-update

In `supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts`, in the new-volunteer loop (around lines 511–540):

- When Surpluss returns 500 with `already exists`/`already assigned` (or 409), do **not** just mark `skipped`. Push the volunteer into `previouslySyncedVolunteers` so it goes through bulk-update with the current `linkedMarketplaceEventId`.
- Stop overwriting the original failed audit-log row to `success=true`. Either insert a new `sync_volunteer_existing` row with `success=true`, or leave the 500 row untouched and rely on the new bulk-update row as proof. The current "find most recent failed and flip it" hack hides real failures.

### 2. Always include `marketplace_event_id` / `event_id` in bulk-update for the targeted run

The bulk-update payload (around lines 547–569) already conditionally adds `marketplace_event_id`. Make sure:

- Every volunteer in this set (including the ones moved over from step 1) gets the marketplace_event_id explicitly.
- If Surpluss's bulk-update endpoint expects an array field like `marketplace_event_ids` or `events_attended_ids`, send that too. We need to confirm the exact field name from Surpluss API docs / a curl test (see "Verification" below).

### 3. Send a volunteer-hours row for *every* matched volunteer, even with 0 hours

In the hours collection block (around lines 723–786):

- Drop the `if (hours <= 0) continue;` guard. Send `hours_contributed: 0` instead.
- For volunteers matched by `events_list` but without any `volunteer_qr_cards` row for this marketplace, also emit a row (`hours_contributed: 0`) so Tractor still attaches them to the event.
- If Surpluss rejects 0-hour rows, fall back to a separate "attach volunteer to event" call (whatever endpoint Tractor exposes for that — see Verification).

### 4. Surface real sync results in the toast

`success: totalFailed === 0` is currently always true because we flip 500s to skipped. After the fix:
- `volunteers_attached_to_event` — actual count we know Tractor accepted (from bulk-update + hours response).
- `volunteers_unmatched` — volunteers in our DB whose `events_list` mentions this marketplace but who couldn't be linked (with the reason).

Show these in `useSurplussVolunteerBeneficiarySync.ts` so admins see the truth.

## Verification

Before deploying, confirm two Surpluss API behaviors with `curl_edge_functions` against `surpluss-allocations-api` (or a quick test edge function):

1. Does `POST /api/common/volunteers/bulk-update` actually attach `marketplace_event_id` (or does it need a different field)?
2. Is there an explicit "attach existing volunteer to marketplace event" endpoint? If yes, use it instead of relying on POST /volunteers + bulk-update.

After deploy, on a test marketplace:
1. Run "Send to Surpluss".
2. Query the audit log: every volunteer in `events_list` for that event should produce either a 200/201 from `sync_volunteer` **or** appear in the bulk-update payload **and** the hours payload.
3. Check Tractor → Distribution Records → that marketplace → Volunteers count matches `SELECT count(*) FROM pending_volunteers WHERE events_list ILIKE '%<slug>%'`.

## Files to change

- `supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts` — steps 1–3 above, plus richer return payload.
- `src/hooks/useSurplussVolunteerBeneficiarySync.ts` — surface `volunteers_attached_to_event` / `volunteers_unmatched` in the toast.

No DB migration. No schema changes. No new tables.

## Out of scope

- Beneficiary count mismatch (handled separately by `sync-surpluss-beneficiaries`).
- Distribution / item counts (handled by `report-surpluss-distribution`).
- Backfilling historical events on Tractor — once the fix ships, re-running "Send to Surpluss" on each old marketplace will reconcile them.
