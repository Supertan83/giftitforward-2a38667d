

## Add and Remove Registered Events for Volunteers

### Current State
- The Volunteers Added details dialog already has an **Add Event** button and dialog that works correctly.
- Events are displayed as simple `Badge` components with no way to remove them.
- There is no remove event mutation.

### Changes Needed

**1. Add a Remove Event Mutation** (in `PendingVolunteers.tsx`)

Create a `removeEventMutation` that:
- Takes the volunteer ID and the event slug to remove
- Filters it out of the `events_list` comma-separated string
- Filters it out of the `events_json` array
- Updates the `pending_volunteers` record
- Also removes the corresponding `registration_events` row if one exists for that slug

**2. Update Event Badges to Include a Remove Button**

Change each event badge (lines ~1773-1776) from a plain badge to a badge with an "X" button:
- Each badge will show the event name and a small close/X icon
- Clicking X will trigger a confirmation, then call the remove mutation
- Styled consistently with the existing UI

**3. Add Confirmation Dialog for Removal**

Add a small alert dialog to confirm before removing an event, to prevent accidental deletions. It will show the event name and ask the admin to confirm.

### Technical Details

Remove mutation logic:
```text
1. Get current volunteer's events_list string
2. Split by comma, filter out the target slug
3. Rejoin with commas (or set to null if empty)
4. Filter events_json array to remove matching entry
5. Update pending_volunteers record
6. Delete matching registration_events row (by registration_id + event_slug)
7. Invalidate queries to refresh UI
```

Badge update (conceptual):
```text
Before: <Badge>Event Name</Badge>
After:  <Badge>Event Name <X onClick={remove} /></Badge>
```

No database schema changes are needed -- this uses existing tables and columns.

