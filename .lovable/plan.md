## Fix: Resend Welcome Email Missing Event Times/Details

### Problem

The `resend-welcome-email` edge function uses a hardcoded email template with a static event reference ("19th of February at the Ajman, Al Hamidya and Boys' Community School Marketplace"). It does not read the volunteer's actual registered events from `events_json`, so recipients see no dates, times, or locations for their specific marketplace events.

The proper `send-welcome-email` function already handles this correctly by dynamically building event blocks with date, time, and location data.

### Solution

Refactor the `resend-welcome-email` function to reuse the same dynamic event rendering logic from `send-welcome-email`. Specifically:

**1. Add helper functions** (copied from `send-welcome-email`):

- `formatTime()` - converts "HH:MM:SS" to "07.00 am" format
- `formatDate()` - converts date string to "February 19, 2026" format
- `buildEventBlock()` - renders an event with red left border showing name, date, location, and timings

**2. Read events from volunteer's `events_json**`:

- Parse the volunteer's `events_json` column (array of event objects with name, date, time, location, etc.)
- For each event, look up the corresponding marketplace record to get `start_time`, `end_time`, `event_date`, and `location`
- Build the formatted event blocks

**3. Replace the hardcoded intro text and event section** with dynamic content:

- Remove the static "19th of February at the Ajman..." paragraph
- Insert the dynamically built event blocks (same red-bordered design as `send-welcome-email`)

### File Changed

- `supabase/functions/resend-welcome-email/index.ts` - Replace the hardcoded HTML template section with dynamic event rendering

### Technical Details

The volunteer's `events_json` contains entries like:

```text
[{ "slug": "ajman-boys-feb-19", "name": "Ajman Boys Community School", ... }]
```

For each event slug, we query the `marketplaces` table to get the full event details (date, start_time, end_time, location), then format them using the same helper functions from `send-welcome-email`.

The rest of the email (QR code, training, credentials, footer) remains unchanged.