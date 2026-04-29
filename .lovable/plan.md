## Problem

"Send to Surpluss" fails on Marketplace Reports with toast `Sync Failed (step: beneficiaries) — Edge Function returned…`.

Root cause confirmed via direct edge function calls + logs:

- Step 1 (`sync-surpluss-volunteer-beneficiary`) returns 200 OK successfully.
- Step 2 (`sync-surpluss-beneficiaries`) is processing **497 new beneficiaries sequentially** for a single marketplace (Mens Aviation – Morning Event). Each iteration does:
  1. `POST /api/common/volunteers` to Surpluss
  2. `INSERT` into `surpluss_api_audit_log`
- 497 × (~300ms upstream + DB insert) easily exceeds the edge runtime wall-clock limit (~150s). The runtime cancels the request, the client receives a network-level error, and the toast surfaces "Edge Function returned…" with no upstream body.

The function never returns an error itself — it gets killed mid-loop. That's why the logs show only `Found … previously synced` / `New beneficiaries: 497` and nothing more.

## Fix

Make `sync-surpluss-beneficiaries` resumable and bounded per invocation, and have the client loop until it's done.

### Edge function changes (`supabase/functions/sync-surpluss-beneficiaries/index.ts`)

1. Accept an optional `batch_size` (default 80) and `offset` (default 0) in the request body.
2. Process at most `batch_size` *new* beneficiaries per invocation:
   - Sort the `newBeneficiaries` list deterministically (e.g. by `unique_id`) so chunks are stable.
   - Slice `newBeneficiaries.slice(offset, offset + batch_size)`.
3. Parallelize within the chunk with bounded concurrency (e.g. 5 in-flight requests) using a small worker pool. Keeps Surpluss happy and brings 80 items down to ~5–10s instead of 30+s.
4. Batch-insert audit log rows once per chunk (single `insert([...])` instead of N inserts).
5. Skip the marketplace-events aggregation step (steps 5–6 in the file) until the final invocation. Return a `done: boolean` and `next_offset: number` so the client knows whether to call again.
6. Keep the current dedup logic (`alreadySyncedUniqueIds`) — fetched once per invocation is fine.

Response shape addition:
```ts
{
  // existing fields…
  done: boolean,            // true when all new beneficiaries processed AND aggregation step ran
  next_offset: number,      // offset to pass to the next call
  processed_in_batch: number
}
```

### Client changes (`src/hooks/useSurplussVolunteerBeneficiarySync.ts`)

Replace the single `invoke('sync-surpluss-beneficiaries')` call with a loop:

```text
offset = 0
totals = { sent: 0, failed: 0, skipped: 0, total: 0, marketplace_events_updated: 0, … }
loop:
  resp = invoke('sync-surpluss-beneficiaries', { marketplace_id, environment, batch_size: 80, offset })
  accumulate counts into totals
  if resp.done -> break
  offset = resp.next_offset
  safety cap: max 30 iterations
```

Update the toast/result so the user sees aggregated `beneficiaries_sent / failed / skipped` across all batches. `currentStepLabel` for the beneficiaries step can show progress: `Syncing beneficiaries… (offset/total)`.

### Why this works

- Each invocation finishes well under the wall-clock limit (≤ ~15s for 80 items at concurrency 5).
- Audit log rows are still written, so dedup across runs continues to work.
- The aggregation/`PUT /marketplace-events/{id}` step runs only on the final batch, when all beneficiaries for the marketplace have been pushed.
- Volunteer sync (step 1) and distribution reporting (step 3) need no changes — they're already fast.

### Verification

1. Test with `marketplace_id = 3f44eb86-f1c5-48a4-8bf3-5b70b41c5bfd` (Mens Aviation – Morning, 497 new beneficiaries) via `curl_edge_functions` per batch.
2. Then trigger from the UI and confirm the toast shows `Sync Complete` with non-zero `beneficiaries_sent`.
3. Re-run; second run should report all skipped (already synced).

## Files to edit

- `supabase/functions/sync-surpluss-beneficiaries/index.ts` — chunking, concurrency, batched audit insert, `done`/`next_offset`.
- `src/hooks/useSurplussVolunteerBeneficiarySync.ts` — paginated loop for step 2, accumulated totals, progress label.

No DB migrations or new secrets required.
