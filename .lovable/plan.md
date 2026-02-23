

# Fix: Auto-Sync "Off" Setting Not Persisting

## The Problem
When you select "Off" from the sync interval dropdown, it correctly disables the cron job. But the next time you open the Sync Monitor, it shows a non-zero interval again -- as if sync is still running.

## Root Cause
In `SurplussSyncMonitor.tsx` (line 91), the code that reads the saved interval from the audit log uses:

```typescript
if (payload?.interval_minutes) {
  setSyncInterval(payload.interval_minutes);
}
```

When the interval is `0` (Off), JavaScript treats `0` as **falsy**, so the condition fails and `setSyncInterval(0)` is never called. The state keeps whatever default value it had, making it look like sync is still active.

## The Fix

**File:** `src/components/admin/SurplussSyncMonitor.tsx` (line 91)

Change the condition from:
```typescript
if (payload?.interval_minutes) {
```
to:
```typescript
if (payload?.interval_minutes !== undefined && payload?.interval_minutes !== null) {
```

This ensures `0` (Off) is properly recognized and stored, so the UI correctly shows "Off" on subsequent visits.

**One line change. No database or edge function changes needed.**

