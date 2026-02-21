

# Fix: Family Member Names Showing as "Family Member 18" Instead of Actual Names

## Problem
Family member rows display generic labels like "Family Member 18" or "Family Member 13" instead of the actual dependent names from `events_json`.

## Root Cause
The QR card ID format is `-F{index}{2_random_chars}` (e.g., `-F1GP`, `-F2XK`). But sometimes the random characters start with a digit (e.g., `-F18G`, `-F13X`). The current regex `/-F(\d+)/` greedily captures all consecutive digits, so `-F13X` yields `13` instead of `1`, and `-F18G` yields `18` instead of `1`. The code then tries to look up `deps[12]` or `deps[17]`, which don't exist, so it falls back to "Family Member 13/18".

## Fix

### File: `src/components/admin/PendingVolunteers.tsx` (line ~3013)

Change the regex from:
```
/-F(\d+)/
```
to:
```
/-F(\d)/
```

This captures only a single digit after `-F`, matching the actual index (1, 2, 3, etc.) and ignoring the random suffix characters that may start with digits.

This same fix should be applied everywhere this pattern is used in the file (the family certs dialog and any other places using the same regex to extract the family index).

