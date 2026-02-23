

# Fix Family Member Names on Certificates

## The Problem
When certificates are sent for family members (during checkout or via the admin dialog), they sometimes display generic names like "Family Member 1" instead of the actual dependent's name (e.g., "Archana", "MANISHA SITLANI").

## Root Cause
The name mapping extracts an index number from the QR card ID (e.g., `-F1`, `-F3`) and uses it to look up the dependent in a list extracted from registration data. This breaks when:
- The regex in the admin dialog only captures single digits (`-F(\d)`) so F10+ fails
- Manually added family members or cards generated with offset indices create misaligned lookups
- The dependents list is shorter than expected due to deduplication differences

## The Fix

### 1. Fix single-digit regex in `PendingVolunteers.tsx` (line 3054)
Change `/-F(\d)/` to `/-F(\d+)/` so it correctly captures multi-digit family indices (F10, F11, etc.).

### 2. Add positional fallback in `useSupabaseData.ts` (lines 1596-1610)
When the index-based lookup fails (dependents array is empty or too short):
- Sort all family cards for this volunteer by their F-index
- Find this card's position in the sorted list
- Use that position to look up the dependent name
- As a last resort, use "Family of [Volunteer Name]" instead of the generic "Family Member N"

### 3. Add the same positional fallback in `PendingVolunteers.tsx` (lines 3053-3059)
Apply the same logic so the admin certificate dialog also resolves names correctly:
- Sort the family cards by F-index
- Match each card's position to the dependents array
- Fall back to "Family of [Volunteer Name]" if still unresolved

## Files to Change
1. **`src/hooks/useSupabaseData.ts`** -- Add positional fallback for name resolution during auto-checkout
2. **`src/components/admin/PendingVolunteers.tsx`** -- Fix regex and add positional fallback in admin certificate dialog

## No database changes needed
All required data (`events_json`, `volunteer_qr_cards`) is already available.
