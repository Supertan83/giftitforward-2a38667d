## Problem

In the volunteer "Add Events to Registration" dialog, selecting multiple events (4, or any N > 1) and clicking **Add N Events** only saves 1 event to the registration.

## Root cause

In `src/components/admin/PendingVolunteers.tsx`, the dialog's confirm handler (around line 3318) loops over `selectedEventsToAdd` and calls `addEventMutation.mutateAsync` once per event.

Inside `addEventMutation` (line 768), each call reads the volunteer's current `events_list` and `events_json` from the React Query cache via `volunteers.find(...)`. That cache is only invalidated in `onSuccess` and is not refetched between the sequential `mutateAsync` calls. Every iteration therefore starts from the **same original** events list, appends one new event, and overwrites the previous iteration's update.

Result: last write wins → only the final selected event is saved, regardless of how many were selected (4, 10, 20, etc.).

## Fix

Replace the per-event loop with a **single batched update** that appends **all** selected events to `events_list` and `events_json` in one Supabase `update` call. This works for any number of selections.

### Changes in `src/components/admin/PendingVolunteers.tsx`

1. Add a new `addMultipleEventsMutation` that accepts the full array of selected event names plus their marketplace metadata, and:
   - Reads the volunteer once.
   - Iterates the array in-memory, appending each event slug to `events_list` (skipping ones already present) and one entry per event to `events_json` (reusing the existing `formatMktDate` / `formatMktTime` helpers).
   - Performs a single `update` on `pending_volunteers` with the final `events_list` and `events_json`.
   - Returns `{ added: string[], skipped: string[] }` for the toast.

2. Update the dialog confirm handler (lines ~3312–3346) to call the new mutation **once** with the entire `selectedEventsToAdd` array instead of looping with `mutateAsync`. Keep the existing toast wording (singular vs plural based on count) and error handling.

3. Leave the existing `addEventMutation` in place if it's still used elsewhere for single-event adds; otherwise remove after a quick search.

No schema, RLS, or backend changes required. Dialog UI and behavior stay identical aside from the bug fix.

## Verification

- Open a pending volunteer, click **Add Event**, select 4 marketplaces → confirm all 4 are saved.
- Repeat with 6+ selections → confirm all of them are saved.
- Re-open the dialog and select an already-present event → confirm it is skipped (no duplicates).
