

# Fix: Populate marketplace details when admin adds event

## Root Cause

When an admin clicks "Add Event" in the volunteer details panel, the `addEventMutation` (line 694-730 of `PendingVolunteers.tsx`) creates an `events_json` entry with only:
```js
{ event: eventSlug, eventDate: null, addedManually: true, addedAt: "..." }
```

It does **not** include `eventDate`, `eventTime`, `eventLocation`, or `name` — even though the full marketplace object (with `event_date`, `start_time`, `end_time`, `location`) is available in the `marketplaces` array used to render the dropdown.

When the resend-welcome-email function later tries to resolve event details, the `events_json` has null values and the fuzzy slug-to-marketplace matching via `ilike` often fails due to slug format differences (dashes vs. spaces, special characters). Result: blank marketplace details in the email.

## Fix

**File**: `src/components/admin/PendingVolunteers.tsx`

**Change 1** — Pass the full marketplace object instead of just the name to the mutation. Update `addEventMutation` (lines 694-730) to:
- Accept the marketplace object (or at least its id, name, event_date, start_time, end_time, location)
- Populate `events_json` with complete details:
  ```js
  {
    event: eventSlug,
    name: marketplace.name,
    eventDate: formatDate(marketplace.event_date),   // "March 12, 2026"
    eventTime: formatTimeRange(marketplace.start_time, marketplace.end_time), // "07.00 am - 01.30 pm"
    eventLocation: marketplace.location,
    addedManually: true,
    addedAt: new Date().toISOString()
  }
  ```

**Change 2** — Update the dialog's "Add Event" button click handler (line 3090-3095) to find the selected marketplace object from the `marketplaces` array and pass it to the mutation instead of just the name string.

This ensures that when the resend-welcome-email function reads `events_json`, it already has the date/time/location as fallback values (lines 113-119 of the edge function), eliminating the dependency on fuzzy slug matching entirely.

No edge function changes needed — the existing fallback logic in `resend-welcome-email` already reads `eventDate`, `eventTime`, `eventLocation` from `events_json` entries.

