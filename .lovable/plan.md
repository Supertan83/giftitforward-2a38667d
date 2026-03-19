

# Fix: Sync Monitor Auto-Sync Won't Stop

## Problem
When you select "Off" from the auto-sync dropdown, it says disabled but the sync keeps running every 30 minutes. On page refresh, you can see new sync entries appearing.

## Root Cause
There is a **ghost cron job (jobid=8)** that was created earlier with a different job name. The current `update-sync-schedule` edge function tries to unschedule a job named `'sync-surpluss-allocations'`, but the actual running job has a different name (or was deleted from `cron.job` while pg_cron's internal scheduler still runs it). The unschedule silently fails every time, so the job keeps firing.

Additionally, the ghost job uses an **old auth key** (`sb_publishable_...`) instead of the current anon key.

## Fix (2 parts)

### 1. Kill the ghost cron job (one-time SQL)
Run via the database migration tool:
```sql
SELECT cron.unschedule(8);
```
This directly unschedules by job ID, which will stop the ghost job immediately.

### 2. Update the edge function to be more robust
Modify `supabase/functions/update-sync-schedule/index.ts` to:
- **Unschedule by both name AND by scanning `cron.job_run_details`** for any job targeting the sync function
- **Query `cron.job`** for any job whose command contains `sync-surpluss-event-allocations` and unschedule those too
- Use a simpler, more reliable approach:

```typescript
// Instead of just trying one name, find and kill ALL sync-related cron jobs
const existingJobs = await client.queryObject(
  `SELECT jobid, jobname FROM cron.job 
   WHERE jobname = 'sync-surpluss-allocations' 
   OR command LIKE '%sync-surpluss-event-allocations%'`
);
for (const job of existingJobs.rows) {
  await client.queryObject(`SELECT cron.unschedule(${job.jobid})`);
}
```

When scheduling a new job, use the **current anon key** (already working) and a consistent job name.

### Files to modify
- **One-time SQL migration**: `SELECT cron.unschedule(8)` to kill the ghost job
- **`supabase/functions/update-sync-schedule/index.ts`**: More robust unschedule logic that finds jobs by command content, not just name

