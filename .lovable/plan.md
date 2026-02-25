
# Make Manual and Webhook Family Member Flows Consistent and Bulletproof

## Problem Summary

There are two ways family members get added:

1. **Webhook (DH registration)** -- dependents come in the payload, get stored in `events_json`, and family QR cards are created automatically
2. **Admin manual add** -- admin clicks "Add Family Member" in the QR Cards viewer, which creates a QR card and appends to `events_json`

Both paths work, but they have subtle inconsistencies that cause issues (like the cleanup function deleting manually-added cards). Here are the specific gaps:

| Issue | Detail |
|-------|--------|
| Missing metadata on manual add | `events_json` update doesn't set `family-members-joining: 'Yes'`, `number-of-adults`, or `total-attendees` |
| Gender not captured | Admin dialog only collects name and type (adult/child), not gender |
| Cleanup function is too aggressive | It treats `events_json` as the sole source of truth -- if a card exists but the dependent somehow isn't in `events_json`, it gets deleted |
| No `event_dependents` table sync | Manual adds don't create records in the `event_dependents` table |
| Admin dialog lacks context | No gender field, no confirmation of what marketplace the family member will attend |

## Changes

### 1. Fix `add_family_member` handler in `webhook-receiver/index.ts`

Update the `events_json` persistence logic (lines 4817-4859) to:
- Set `family-members-joining` to `'Yes'` on the event entry
- Update `number-of-adults` / `number-of-children` and `total-attendees` counts
- Include the `index` field matching the family card's F-index for reliable name resolution
- Also insert into `event_dependents` table (if a `registration_events` record exists for the volunteer)

### 2. Add gender field to admin "Add Family Member" dialog

**File: `src/components/admin/VolunteerQRCardsViewer.tsx`**

- Add a `newFamilyMemberGender` state (`'Male' | 'Female' | null`)
- Add a gender select dropdown in the dialog
- Pass `gender` in the mutation payload so the webhook-receiver stores it in `events_json`

### 3. Make cleanup function respect manually-added cards

**File: `supabase/functions/cleanup-duplicate-family-cards/index.ts`**

The current logic: if `events_json` shows N dependents, delete all family cards beyond N.

The fix: **never delete a family card whose name is found in `events_json`**. Only delete cards that are truly orphaned (no matching dependent name AND exceed the expected count). Since the manual add flow now correctly writes to `events_json`, this becomes a safety net rather than the primary mechanism.

Specifically:
- After extracting dependents from `events_json`, compare card count vs dependent count
- Only flag cards as "excess" if card count exceeds dependent count
- Among excess cards, only delete those that are `inactive` (not `checked_in` or `checked_out`) -- tighten from current logic which also deletes `checked_out`

### 4. Update `generate-missing-family-qrs` edge function

**File: `supabase/functions/generate-missing-family-qrs/index.ts`**

No changes needed -- this function already reads from `events_json` and creates missing cards. Since the manual add flow now properly updates `events_json`, this function will work correctly for both flows.

## Technical Summary

| File | Change |
|------|--------|
| `supabase/functions/webhook-receiver/index.ts` | Enhance `add_family_member` handler to write complete metadata to `events_json` (family-members-joining, counts, index) and optionally sync to `event_dependents` |
| `src/components/admin/VolunteerQRCardsViewer.tsx` | Add gender select to Add Family Member dialog, pass gender to mutation |
| `supabase/functions/cleanup-duplicate-family-cards/index.ts` | Tighten deletion logic: only delete `inactive` excess cards, never cards with matching dependent names |

## Result

After these changes:
- Manual adds and webhook adds produce identical `events_json` structure
- The cleanup function won't accidentally delete manually-added family cards
- Certificates, exports, and all UI surfaces will show consistent family member data regardless of how they were added
- Gender information is captured for both flows
