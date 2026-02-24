

# Fix: Manually Added Family Members Missing from "Volunteers Added" Tab

## Problem

When an admin adds a family member via the "Volunteer QR Cards" viewer (using the + button), the backend creates the QR card but does **not** update the volunteer's `events_json` with the new dependent's name and type. Since every display surface ("Volunteers Added" tab, "Family Members" tab, certificate dialogs, export reports) reads family member names from `events_json.dependents`, the manually added family member either:

- Does not appear at all in "Volunteers Added", or
- Shows as a generic "Family Member 1" / "Family of [Name]" label instead of the actual name entered by the admin.

Family members arriving via webhook already have their names stored in `events_json.dependents`, so they display correctly. The gap is exclusively in the manual add path.

## Solution

Update the `add_family_member` action in the backend to also persist the new dependent into the volunteer's `events_json` array. This ensures a single source of truth and makes the name immediately visible across all UI surfaces without any frontend changes.

## Technical Details

### File: `supabase/functions/webhook-receiver/index.ts` (line ~4797-4812)

After creating the family QR card, add logic to update the volunteer's `events_json`:

1. Fetch the volunteer's current `events_json` from `pending_volunteers`.
2. If `events_json` exists and has at least one event entry, append the new dependent (`{ name, type, gender }`) to the first event's `dependents` array (deduplicating by normalized name).
3. If `events_json` is empty/null, create a minimal structure with the dependent so name resolution still works.
4. Update `pending_volunteers.events_json` with the modified array.

```text
Current flow:
  1. Create QR card in volunteer_qr_cards  -->  DONE
  2. Return success

Updated flow:
  1. Create QR card in volunteer_qr_cards  -->  DONE
  2. Fetch volunteer's events_json
  3. Append { name, type, gender } to dependents array (deduplicate)
  4. Update pending_volunteers.events_json
  5. Return success
```

### Why this is sufficient

- All UI components (`PendingVolunteers.tsx`, `FamilyMembersTab.tsx`, `VolunteerQRCardsViewer.tsx`, export logic) already read from `events_json.dependents` and resolve names using index-based matching against family QR card IDs.
- By persisting the dependent data at the source, no frontend changes are needed -- existing name resolution logic will pick up the new entry automatically.
- The deduplication uses the same normalized-name matching already used elsewhere (lowercase comparison, substring check).

### Scope

| File | Change |
|------|--------|
| `supabase/functions/webhook-receiver/index.ts` | After QR card creation in `add_family_member` handler (~line 4812), add 15-20 lines to fetch and update `events_json` with the new dependent |

This is a backend-only fix with no migration and no frontend changes required.

