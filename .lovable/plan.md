

## Fix: Volunteers receiving reminder emails for wrong marketplace dates

### Problem
The email automation system matches volunteers to marketplace events using **substring matching** (`string.includes()`). This causes false positives:
- A volunteer registered for **March 1** (`...march-1`) also matches **March 10, 11, 12** etc., because `"march-1"` is a substring of `"march-10"`, `"march-11"`, `"march-12"`.

### Solution
Replace the fuzzy `includes()` matching with **exact event date matching** using the structured `events_json` data, which contains precise event slugs and dates.

### Changes

**File: `supabase/functions/run-email-automations/index.ts`**

Replace the volunteer-to-marketplace matching block (lines ~138-166) with date-based matching:

1. **Primary match: by `eventDate`** -- Compare the volunteer's `events_json[].eventDate` (e.g., "March 1, 2026") against the marketplace's actual `event_date` from the database. This is the most reliable match since dates are unambiguous.

2. **Secondary match: by exact slug** -- If a volunteer's `events_json[].event` slug exactly equals the marketplace name (normalized to slug format), it's a match. Use exact equality (`===`) instead of `includes()`.

3. **Remove the `events_list` substring matching** -- The `matchesByName` check using `eventsList.includes(...)` is the root cause of false positives and will be removed entirely.

### Technical Detail

```text
BEFORE (broken):
  slug "...march-1".includes("march-12" normalized) => partial match => WRONG

AFTER (fixed):
  volunteer eventDate "March 1, 2026" vs marketplace event_date "2026-03-12" => no match => CORRECT
  volunteer slug "...march-1" === marketplace slug "...march-12" => no match => CORRECT
```

The fix normalizes marketplace `event_date` (e.g., `2026-03-01`) into the same format volunteers store (e.g., `"March 1, 2026"`) for reliable date comparison, and uses exact slug equality as a fallback.

