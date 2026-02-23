

# Fix: Duplicate Family QR Cards - Regex Bug

## Root Cause

The regex `/-F\d+[A-Z0-9]+$/` used to identify family QR cards **fails** when the 2-character random suffix is all digits.

**How QR IDs are generated:** `{volunteerQRId}-F{index}{2-random-chars}` where random chars come from `Math.random().toString(36).substring(2,4).toUpperCase()` (can produce digits like "07", "71", "00").

**Examples of broken IDs:**
- `VOL-...-F207` -- regex thinks `\d+` = "207", nothing left for `[A-Z0-9]+` = **no match**
- `VOL-...-F100` -- regex thinks `\d+` = "100", nothing left = **no match**

This means the `generate-missing-family-qrs` function undercounts existing family cards and creates extras. At least 18 cards in the database have this issue, affecting multiple volunteers.

A secondary issue: `extractUniqueDependents` deduplicates by exact name match, so the same family member registered across events with slightly different names (e.g., "AZAAN BIN MISBA" vs "AZAAN") creates additional phantom dependents, leading to even more excess cards.

## Fix Plan

### 1. Fix the Regex Everywhere (3 files)

Replace all instances of `/-F\d+[A-Z0-9]+$/` with a simpler, correct pattern: `/-F\d+/`

This matches any card ID containing `-F` followed by one or more digits, which is sufficient to identify family cards. The regex is used in:

- **`supabase/functions/generate-missing-family-qrs/index.ts`** (lines 78, 85) -- primary card detection and family card counting
- **`src/hooks/useMarketplaceAllocations.ts`** -- family name resolution uses a similar pattern for sorting/filtering

### 2. Fix the generate-missing-family-qrs Function

Update the function to use the corrected regex so it accurately counts existing family cards and stops creating duplicates.

### 3. Fix the webhook-receiver Function

Update the regex in `webhook-receiver/index.ts` if any similar patterns exist there for family card detection.

### 4. Clean Up Duplicate Cards (SQL)

Write a cleanup query to identify and delete the excess family QR cards that were erroneously created. For each volunteer:
- Keep the original family cards (earliest `created_at`)
- Delete extras that exceed the actual number of dependents
- Only delete cards with status `inactive` (never used) to be safe
- Cards that are `checked_in` should be investigated manually

### 5. Improve extractUniqueDependents Deduplication

Improve the name matching logic to handle minor variations (e.g., partial names). Use first-name matching or fuzzy comparison so "AZAAN" and "AZAAN BIN MISBA" are recognized as the same person.

## Technical Details

### File Changes

**`supabase/functions/generate-missing-family-qrs/index.ts`**
- Line 78: Change `!/-F\d+[A-Z0-9]+$/.test(c.unique_id)` to `!/-F\d+/.test(c.unique_id)`
- Line 85: Change `/-F\d+[A-Z0-9]+$/.test(c.unique_id)` to `/-F\d+/.test(c.unique_id)`

**`src/hooks/useMarketplaceAllocations.ts`**
- Update all regex patterns for family card detection to use `/-F\d+/`

**`supabase/functions/generate-missing-family-qrs/index.ts` and `supabase/functions/webhook-receiver/index.ts`**
- Improve `extractUniqueDependents` to normalize names before deduplication: trim, lowercase, and also check if one name is a substring of another (e.g., "azaan" matches "azaan bin misba")

### Cleanup SQL

```sql
-- Delete excess family QR cards (only inactive ones)
-- Step 1: Identify volunteers with more family cards than dependents
-- Step 2: Keep earliest N family cards (N = actual dependent count)
-- Step 3: Delete the rest where status = 'inactive'
```

This will be executed after the code fix is deployed to prevent the issue from recurring.

## What Does Not Change

- The check-in/check-out flow
- The primary QR card generation
- The webhook-receiver's initial family card creation (first registration)
- Card statuses or attendance records

