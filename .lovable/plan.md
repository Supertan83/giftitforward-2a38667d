# Multi-select events when adding to a volunteer's registration

## Goal
In the "Add Event to Registration" dialog (Volunteers Added → volunteer profile → Add New Event), allow admins to select multiple marketplaces at once instead of just one.

## Changes (single file: `src/components/admin/PendingVolunteers.tsx`)

1. **State**: Replace `selectedEventToAdd: string` with `selectedEventsToAdd: string[]`.

2. **UI**: Replace the shadcn `Select` with a checkbox list inside a scrollable container (`max-h-72 overflow-y-auto` with bordered rows). Each row shows the marketplace name + date, same filtering rules (hide already-registered events). Add a small "X selected" counter and a "Select all / Clear" toggle for convenience.

3. **Submit handler**: On click of "Add Events", iterate the selected names and call `addEventMutation.mutateAsync(...)` sequentially for each (sequential to keep the existing single-event mutation logic safe against concurrent reads of `events_list`/`events_json` for the same volunteer). After all complete, close the dialog, clear selection, and show one combined toast like "3 events added to Sarah's registration".

4. **Button label/state**: 
   - Button text: "Add Event" when 0–1 selected, "Add N Events" when >1.
   - Disabled when `selectedEventsToAdd.length === 0` or while in-flight.

5. **No backend changes**: `addEventMutation` already correctly merges into `events_list` and `events_json` and respects existing entries. Reusing it sequentially preserves the existing time-slot logic and avoids duplicating mutation code.

## Out of scope
- No schema, RLS, or edge function changes.
- No changes to the "Remove event" flow or to the volunteer profile view.
- No changes to time-slot matching logic introduced earlier.
