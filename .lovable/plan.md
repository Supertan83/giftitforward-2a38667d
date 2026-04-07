

## Fix: Same-Date Events Matching Wrong Name (Morning vs Afternoon)

### Problem
Two "Taxi Drivers Marketplace" events exist on the same date (April 18) — one Morning, one Afternoon. The slug matching in `getMarketplacesBySlug` uses a threshold of ≥2 matching words and `break`s on the first hit. Since both DB entries match "taxi" + "drivers" (≥2), the loop always picks whichever comes first in the DESC-ordered list, ignoring whether "morning" or "afternoon" actually matches.

### Solution

**File: `supabase/functions/webhook-receiver/index.ts`**

Change the matching logic in `getMarketplacesBySlug` (lines 430-458) from "break on first ≥2 match" to "score all candidates and pick the highest match count":

1. Instead of `break` on first name+date match, track `bestMatchCount` alongside `bestMatch`
2. Only update `bestMatch` when `matchCount > bestMatchCount`
3. Continue iterating all marketplaces to find the most specific match
4. This way, for the afternoon slug, "taxi"+"drivers"+"afternoon"+"event" will score 4 against "Taxi Drivers Marketplace Afternoon Event" vs 3 against "...Morning Event"

```text
Current logic (simplified):
  for mp of marketplaces:
    if matchCount >= 2 && dateMatches:
      bestMatch = mp
      break  ← picks first match, wrong for same-date events

Fixed logic:
  bestMatchCount = 0
  for mp of marketplaces:
    if matchCount >= 2 && dateMatches && matchCount > bestMatchCount:
      bestMatch = mp
      bestMatchCount = matchCount
      // NO break — continue to find best match
```

This single change ensures "afternoon" in the slug only matches the Afternoon Event, not the Morning Event.

