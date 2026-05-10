## Problem

Two related issues in **Admin → Marketplace Reports** volunteer list:

1. **Deleting a checked-in / checked-out volunteer (CASE 1 in `handleConfirmDelete`)** only soft-deletes their `volunteer_qr_cards` + `volunteer_attendance` rows. The volunteer's `pending_volunteers` row still has this marketplace's slug in `events_list`, so the report's `formRegisteredVolunteers` query immediately re-adds them as **Inactive**.
2. **Deleting an Inactive (form-registered) volunteer (CASE 2)** rewrites `events_list` / `events_json` to strip the matching event. In practice this is fragile: `eventSlugMatchesMarketplace` is a fuzzy matcher (token + date + slot), and slugs that don't perfectly match aren't stripped, so the volunteer keeps reappearing after refresh.

Both bugs let "deleted" volunteers come back, breaking parity with the Tractor Dashboard. The user also wants a bulk-delete to clean up many rows at once.

## Fix

Introduce an explicit, durable per-marketplace **exclusion list** as the source of truth, instead of trying to mutate the volunteer profile.

### 1. Database

Create `public.marketplace_volunteer_exclusions`:

| column | type | notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| marketplace_id | uuid NOT NULL | indexed |
| volunteer_id | uuid NOT NULL | references `pending_volunteers.id` logically |
| dependent_name | text NULL | NULL = primary volunteer; non-null = a single family dependent |
| excluded_by | uuid NULL | `auth.uid()` of admin |
| created_at | timestamptz NOT NULL DEFAULT now() |
| deleted_at | timestamptz NULL | soft-delete (project convention) |

Plus:
- Unique index on `(marketplace_id, volunteer_id, COALESCE(dependent_name, ''))` where `deleted_at IS NULL`.
- RLS: admins manage; staff can read.

### 2. Report builder (`src/hooks/useMarketplaceAllocations.ts`, `useMarketplaceReport`)

- Fetch exclusions for the current `marketplaceId` once (`SELECT volunteer_id, dependent_name WHERE marketplace_id = X AND deleted_at IS NULL`).
- Build two sets: `excludedVolunteerIds` (rows where `dependent_name IS NULL`) and `excludedDependents` (Set of `${volunteer_id}|${name.toLowerCase()}`).
- Filter:
  - `formRegisteredVolunteers` — drop entries whose `id ∈ excludedVolunteerIds`.
  - `volCardMap` (attendance source) — drop entries whose `vol.id ∈ excludedVolunteerIds`.
  - Dependents from `extractDependentsForMarketplace` — drop entries matching `excludedDependents`.
- Recompute totals (`totalRegisteredFromForm`, `totalFamilyMembers`, category counts) from the filtered lists so headline numbers shrink too.

### 3. Delete handler (`src/components/admin/MarketplaceReports.tsx`, `handleConfirmDelete`)

- **CASE 1 (cardId present)**: keep existing card + attendance soft-delete, **and** look up the card's `volunteer_id`, then upsert an exclusion `(marketplace_id, volunteer_id, NULL)`. This blocks the form-registered re-entry.
- **CASE 2 (volunteerId / inactive)**: replace the events_json/events_list mutation with a single upsert into `marketplace_volunteer_exclusions` `(marketplace_id, volunteerId, dependentName ?? null)`. Leave `pending_volunteers` untouched so other marketplaces / global views are unaffected.
- Invalidate the same React Query keys as today.

### 4. Bulk delete UI (`MarketplaceReports.tsx`)

- Make checkbox selection support cardless rows by using a composite key (`cardId` if present, otherwise `vol-${volunteerId}-${dependentName ?? ''}`). Switch the existing `selectedCardIds: Set<string>` to `selectedRowKeys: Set<string>` and store the source row alongside.
- Add a **Delete selected** destructive button in the existing selection toolbar (next to "Edit Hours").
- Open an `AlertDialog` confirming the count, then loop the same per-row delete logic in parallel via `Promise.all`, finally invalidate queries and clear selection.
- Toast summarising successes / failures.

## Why this fixes the reported behaviour

- The exclusion table is checked unconditionally in the report, so a deleted volunteer cannot reappear via *any* path (card, attendance, events_list, events_json, family dependent extraction).
- Slug-matching fragility no longer matters — exclusion is keyed by stable UUIDs.
- Bulk delete reuses the same code path so behaviour is identical for one row or many.
- `pending_volunteers` stays intact, preserving cross-marketplace data and audit history.

## Out of scope

- No changes to volunteer global profile, training data, or other marketplaces.
- No change to the actual volunteer record / auth user.
- Tractor Dashboard / Surpluss-side data is not modified by this change; the user must re-run their existing sync to push the cleaned list out.
