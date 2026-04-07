

## Fix: Welcome Email Shows Wrong Marketplaces

### Problem

When volunteers register via the DH form for new marketplaces (e.g., "Women Community Workers Marketplace" on April 11), the welcome email incorrectly shows older marketplaces (e.g., "She Thrives Women Workers Marketplace February 28").

**Root cause:** The `getMarketplacesBySlug` function in `webhook-receiver` uses fuzzy word-matching to find marketplaces. New DH form slugs (like `women-community-workers-marketplace---afternoon-event`) don't contain month names, so `extractDateFromSlug` returns null. Without a date constraint, the function picks the **first marketplace** (oldest by date) that has ≥2 matching words — which is the wrong one.

### Why It Fails for This Volunteer

```text
Slug: women-community-workers-marketplace---afternoon-event
→ extractDateFromSlug: null (no month name in slug)
→ Word matching: "women", "community", "workers", "afternoon", "event"
→ First match (by date ASC): "She Thrives Women Workers Marketplace February 28"
   (matches "women" + "workers" = 2 words ✓)
→ WRONG! Should be "Women Community Workers Marketplace Morning Event" (April 11)
```

### Solution

**Priority 1: Use form data directly instead of fuzzy DB lookup**

The `eventsJson` from the form already contains the correct `eventDate`, `eventTime`, and `eventLocation`. The code at line 888 says "IMPORTANT: Prioritize form data" but then uses `dbMarketplace?.name` for the event name (line 910), which is the matched (wrong) DB name.

**Changes to `webhook-receiver/index.ts`:**

1. **Improve `getMarketplacesBySlug`**: When no date is extractable from the slug, use the `eventDate` field from the `RegisteredEvent` to filter by date. Pass the events array alongside slugs so date context is available.

2. **Better fallback name generation**: When no DB match is found, use form data fields (`eventDate`, `eventLocation`, `eventTime`) directly and generate a cleaner name from the slug (the code already does this at line 911-915, but the problem is it matches the *wrong* DB entry, not *no* entry).

3. **Add date cross-validation**: When a DB match is found via fuzzy name matching, cross-validate against the form's `eventDate`. If they don't match, discard the DB match and use form data instead.

### Technical Details

**File: `supabase/functions/webhook-receiver/index.ts`**

- Modify `getMarketplacesBySlug` to accept an optional map of slug → eventDate strings
- When `extractDateFromSlug` returns null but a form eventDate is provided, parse and use that date for matching
- Add cross-validation: after fuzzy matching, if form eventDate is available, verify the matched DB entry's `event_date` is within 1 day of the form date; if not, discard the match
- Order marketplace query by `event_date DESC` (newest first) instead of `ASC` as an additional safety measure for the no-date fallback case

### Data Flow After Fix

```text
Slug: women-community-workers-marketplace---afternoon-event
Form eventDate: "April 11, 2026"

Step 1: extractDateFromSlug → null (no month in slug)
Step 2: Use form eventDate → { month: 4, day: 11 }
Step 3: Fuzzy match + date filter → "Women Community Workers Marketplace Morning Event" (April 11) ✓
   OR if no DB match → use form data directly (name from slug, date/time/location from form)
```

