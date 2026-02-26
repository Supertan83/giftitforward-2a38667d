

## Fix: Resent Welcome Emails Missing Event Information

### Investigation Findings

**Data is correct** -- Kifah's record (`13e642ff`) has all 3 events in `events_json` with complete `eventDate`, `eventTime`, and `eventLocation` for each:
- Event 0: Inclusive Community (March 12)
- Event 1: Stronger Together Single Mothers (March 14)
- Event 2: She Thrives Women Workers (March 7)

**The resend code path** (`webhook-receiver` > `resend_email` action > `sendWelcomeEmailWithQR`) should correctly build `registeredEvents` from this data and render the event details HTML.

**However**, two issues were identified that could cause event information to be missing or degraded:

### Issue 1: Silent Failure in Event Resolution (Primary Suspect)

The `getMarketplacesBySlug` function (line 885) is called BEFORE the form-data fallback at lines 894-906. If `getMarketplacesBySlug` throws an uncaught error for any of the 3 slugs, the entire `for` loop at line 889 would abort, leaving `registeredEvents` empty. The function has a try/catch but only around the DB query, not around individual slug processing.

Additionally, the `.or()` filter at line 89 in `buildEventsHtml` (used by `resend-welcome-email`) uses unsafe slug interpolation: slugs containing special PostgREST characters could cause query failures.

### Issue 2: Event Name Display with Triple Dashes

Slugs like `marketplace---march-7` (triple dash) produce ugly fallback names when DB lookup fails.

### Fix Plan

**File: `supabase/functions/webhook-receiver/index.ts`**

1. **Wrap individual event processing in try/catch** (lines 889-926): If one event fails to resolve from DB, continue to the next instead of aborting the entire loop. Always fall back to `events_json` form data.

2. **Add detailed logging** for resend operations: Log the number of events found in `events_json`, the number of `registeredEvents` built, and any errors during resolution. This will help diagnose if the issue recurs.

3. **Log events data in email send logs**: Currently the `request_payload` only logs `{to, subject, isFallback}`. Add `eventCount: registeredEvents.length` so we can see in the admin panel whether events were included.

**File: `supabase/functions/resend-welcome-email/index.ts`**

4. **Same try/catch protection** in `buildEventsHtml` (lines 75-117): Wrap each event iteration in try/catch so one bad event doesn't prevent all events from rendering.

5. **Better slug-to-name conversion**: Clean triple dashes and produce readable event names when DB lookup fails.

### Technical Changes

**webhook-receiver/index.ts -- Event loop protection (around line 889)**
```text
for (const evt of eventsJson as RegisteredEvent[]) {
  try {
    const dbMarketplace = marketplaceDetails.get(evt.event);
    // ... existing resolution logic ...
    registeredEvents.push({ ... });
  } catch (evtError) {
    console.error(`Error resolving event "${evt.event}":`, evtError);
    // Fall back to raw form data
    registeredEvents.push({
      name: evt.event?.split('-').filter(Boolean).map(...).join(' ') || 'Gift It Forward Marketplace',
      date: evt.eventDate || '',
      time: evt.eventTime || '',
      location: evt.eventLocation || '',
      rawStartTime: null,
      rawEndTime: null,
      rawDate: null
    });
  }
}
```

**webhook-receiver/index.ts -- Enhanced logging (around line 5077)**
```text
console.log(`Resend: volunteer ${pending_id} has ${resolvedEventsJson?.length || 0} events in events_json`);
```

**webhook-receiver/index.ts -- Log event count in email send log (line 1544)**
```text
{ to: email, subject: emailSubject, isFallback, eventCount: registeredEvents.length }
```

**resend-welcome-email/index.ts -- Same protection in buildEventsHtml (line 75)**
```text
for (const evt of eventsJson) {
  try {
    // ... existing logic ...
    eventBlocks.push(buildEventBlock({ ... }));
  } catch (blockError) {
    console.error(`Error building event block for "${evt?.event}":`, blockError);
    // Fall back to raw form data
    eventBlocks.push(buildEventBlock({
      name: evt?.event || 'Gift It Forward Marketplace',
      date: evt?.eventDate || '',
      time: evt?.eventTime || '',
      location: evt?.eventLocation || '',
    }));
  }
}
```

### Files to Modify
- `supabase/functions/webhook-receiver/index.ts` -- Add try/catch in event loop, enhance logging, log event count
- `supabase/functions/resend-welcome-email/index.ts` -- Add try/catch in `buildEventsHtml`

### Verification
After deploying, resend the welcome email for Kifah (pending_id `13e642ff-8e0e-434d-b341-40c8d9231c16`) and check:
1. Edge function logs for the event count messages
2. Email send logs for `eventCount` in the request payload
3. The actual email received should show all 3 events with dates, times, and locations

