## Root cause

I traced the missing volunteers and the cause is **NOT** a bug in report logic — it's the "Remove from marketplace" / bulk-delete button on the Marketplace Reports page being used today (May 11).

When that button is clicked, `performDelete` in `MarketplaceReports.tsx` does **two destructive things**:
1. **Soft-deletes the volunteer_attendance rows** (sets `deleted_at`) for that card+marketplace, AND soft-deletes the `volunteer_qr_cards` row if it belongs to that marketplace.
2. Inserts an **exclusion row** in `marketplace_volunteer_exclusions` so the volunteer is permanently hidden from that marketplace's report.

Today's damage (all created today between ~09:40 and ~11:04):

| Marketplace | Attendance soft-deleted today | Exclusion rows |
|---|---|---|
| Single Mothers Morning Event | 12 | 0 |
| Single Mothers **Morning Event 2** (your example) | **11** | **5** |
| Single Mothers Afternoon Event | 9 | 8 |
| Single Mothers Afternoon Event 2 | 9 | 7 |
| Single Mothers Afternoon Event 3 | 4 | 4 |
| Young Dreamers Boys School | 0 | 14 |
| She Thrives Women Workers Feb 28 | 0 | 7 |
| Bus Activation | 1 | 3 |
| ~10 other marketplaces | 1 each | 1–2 each |

Verified for Morning Event 2: `volunteer_attendance` has 90 live attended cards + 11 soft-deleted today = **101 originally checked-in**. Report shows 79 because the 11 soft-deletes drop the live attendance count to 90, and another adjustment from the registered-volunteer pipeline knocks it to 79 in the UI (matches your screenshot exactly).

## Plan

### 1. Restore today's deletions (one-shot data fix)
Run two updates, scoped strictly to changes made today, so we don't touch anything legitimate:

- **Restore soft-deleted attendance:** set `volunteer_attendance.deleted_at = NULL` where `deleted_at::date = '2026-05-11'`. (~56 rows across ~16 marketplaces.)
- **Restore soft-deleted volunteer QR cards:** set `volunteer_qr_cards.deleted_at = NULL` where `deleted_at::date = '2026-05-11'`. (Cards that were wiped along with attendance.)
- **Soft-delete the exclusion rows** created today in `marketplace_volunteer_exclusions` (`deleted_at::date = '2026-05-11'`) so excluded volunteers reappear in their reports. (~57 rows across 14 marketplaces.)

After this, every marketplace report will show its true attended numbers again. You'll just need to refresh the reports page (React Query cache).

### 2. Add a safety guard to the delete UI (prevent recurrence)
Two small frontend-only changes in `src/components/admin/MarketplaceReports.tsx`:

- **Stronger confirm dialog** for both single and bulk delete: explicitly state "this removes the volunteer from this marketplace report AND deletes their attendance record" and require the admin to confirm. Today's wording ("Removed from marketplace") sounds harmless.
- **Disable bulk delete by default** (require an explicit "Enable bulk remove" toggle for the current session) so accidental selection-and-click can't wipe many rows in one shot.

No changes to the report computation logic — it's working correctly given the data it sees.

### 3. (Optional, after deadline) Add an "Undo today's removals" admin tool
A small panel in the Marketplace Reports page that lists removals/exclusions made in the last 24h with a one-click restore, so we never have to do a manual SQL fix again. Out of scope for tonight unless you ask for it.

## Technical details

- Restore is done with a `supabase--migration` (UPDATE statements, scoped by `deleted_at::date = '2026-05-11'`).
- After restore, no code change is required for the numbers to be correct — `useMarketplaceAllocations` already filters by `deleted_at IS NULL` and reads exclusions from `marketplace_volunteer_exclusions`.
- The UI-level safeguard is purely presentational (extra confirm step + bulk-mode toggle) — no business-logic change.

## What I need from you

Just confirm: **"go ahead, restore today's deletions and add the safety guard."** I'll run the restore migration first (so your numbers are correct in time for the press release), then patch the UI.
