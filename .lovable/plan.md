
Goal: fix the recurring “failed to send a request to the edge function” error during “Sync Donations” from Sync Monitor, based on logs showing partial processing followed by abrupt shutdown.

What I found from logs and code:
- The frontend successfully calls `fetch-surpluss-allocations` repeatedly and gets `200` with large payloads.
- `sync-surpluss-allocations` logs show many donations being processed (`Updated item_type...`, `Synced donation...`) but no completion log (`Sync complete`), then shutdown.
- This pattern strongly suggests batches are still too heavy (time/payload pressure), so invocation ends before responding, which surfaces in the client as request-send failure.
- Current `SurplussSyncMonitor.tsx` batching to 25 helps, but still sends full donation objects (including large nested fields not needed by sync).

Implementation plan:

1) Harden Sync Monitor request payload
- File: `src/components/admin/SurplussSyncMonitor.tsx`
- In `handleSyncDonations`, sanitize each fetched donation into a minimal object before syncing.
- Keep only fields used by `sync-surpluss-allocations`:
  - top-level: `id`, `uuid`, `title`, `description`, `active`, `quantity`, `item_count`, `box_count`, `condition_id`, `image_url`, `price`, `per`, `frequency`, `created_at`, `updated_at`, `donation_tag`, `donation_tag_subcategory`, `material_group_id`, `third_level_subcategory_id`, `type`, `sdg_goals`
  - nested: `company` (only fields used), `address` (only fields used), `material_group` (only fields used)
- Drop heavy unused fields like `images`, `image_name`, `upload_filename`, etc.

2) Reduce batch size and add fallback retry
- Change `CHUNK_SIZE` from `25` to `10` for safer execution windows.
- If a batch fails to invoke:
  - retry that same chunk once;
  - if still failing, split that failed chunk into single-item calls (size 1) and continue.
- This avoids one problematic chunk killing the whole run.

3) Improve batch-level error handling and resilience
- Validate each sync response:
  - if `syncError` exists, treat as failed batch;
  - if response exists but `success !== true`, treat as failed batch and capture backend error string.
- Continue processing remaining batches whenever possible.
- Accumulate:
  - `totalCreated`, `totalUpdated`, `totalFailed`,
  - `failedBatches` and `failedDonationCount` for final reporting.

4) Improve UX feedback during long sync
- Add progress toasts or status messages every N batches (e.g. “Batch 3/47 complete”).
- Final toast should show:
  - created/updated/failed counts,
  - total donations attempted,
  - number of batches,
  - whether fallback single-item retries were used.
- If some batches fail, use warning/destructive toast with actionable text (“some items synced, some failed”).

5) Add defensive logging for supportability
- In frontend: log batch index, chunk size, and first donation ID on failure.
- In `sync-surpluss-allocations` (backend function), add/ensure:
  - start log for each invocation with allocation count,
  - end log summary always when successful,
  - per-item failures already logged (keep).
- This makes future failures diagnosable quickly.

Verification plan:
1. Trigger “Sync Donations (Fix Stock Totals)” from Sync Monitor on production environment.
2. Confirm no immediate “failed to send request” error.
3. Confirm progress and final summary toast appears.
4. Check backend logs show multiple smaller invocations with completion summaries.
5. Spot-check database results for previously incorrect items (e.g., Kids Boys Perfume) to confirm corrected `total_stock`.
6. Validate UI remaining balances in Allocation Management reflect corrected totals.

Technical notes:
- No schema changes required.
- No secret/config changes required.
- This is a robustness fix in orchestration and payload shaping; core sync logic remains source-of-truth in `sync-surpluss-allocations`.
