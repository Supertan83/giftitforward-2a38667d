
Goal: fix three related email reliability issues so volunteers always receive complete onboarding emails:
1) family-member QR codes appear in “Thank you for registering” emails,
2) marketplace/event details appear in resend emails,
3) manually created volunteers from Manage Users can receive marketplace-aware emails without missing event data.

What I found from your report + uploaded video:
- The video says: admin manually creates a volunteer, then resends welcome email, but marketplace details are missing.
- In the current backend logic:
  - manual create-user flow stores little/no structured event data (`events_json` often empty),
  - resend logic depends mostly on `events_json`,
  - some email paths render family QR sections, but not all of them consistently.
- Database check confirms there are approved volunteers with no `events_json` but with assigned marketplace cards, so data exists but is not always used to build email content.

Root causes (technical):
1) In `webhook-receiver` resend flow, family QR rendering is tied to dependent data length, so valid family QR cards can be skipped if dependent metadata is incomplete/misaligned.
2) Event rendering in resend paths relies on `events_json`; if missing (common in manual user creation), marketplace block is empty even when QR cards have `marketplace_id`.
3) `send-welcome-email` template path does not currently support family QR section, so flows using that function may omit family QRs.
4) `create-user` + Manage Users creation flow doesn’t capture/normalize marketplace event context robustly enough for immediate email reuse.

Implementation plan (sequenced):

Phase 1 — Harden email context resolution in backend (highest impact, no UI dependency)
1. Create a shared “email context resolver” inside `supabase/functions/webhook-receiver/index.ts`:
   - Inputs: `pending_volunteer_id`, `events_json`, `events_list`, volunteer QR cards, marketplace assignments.
   - Resolution order:
     1) `events_json` (best source when available),
     2) parse `events_list` slugs/names and map to marketplace events,
     3) fallback to `volunteer_qr_cards.marketplace_id` assignments (distinct, ordered),
     4) final fallback: empty safely (no crash).
   - Output:
     - normalized event blocks for email,
     - first marketplace info/id for legacy single-marketplace paths,
     - normalized family QR list independent of dependent-count assumptions.
2. Update resend action in `webhook-receiver` (`payload.action === 'resend_email'`) to use resolver:
   - Always include all family QR cards after primary card.
   - Map names from dependents when available; fallback to generic labels if not.
   - Ensure event details are built even when `events_json` is null but marketplace assignments exist.

Phase 2 — Ensure all welcome-email providers can render family QR + events
3. Extend `supabase/functions/send-welcome-email/index.ts` request contract:
   - Add optional family QR payload array.
   - Render family section in HTML when present (same visual style as resend template).
   - Keep backward compatibility (if absent, no section).
4. Update Microsoft Graph path call site in `webhook-receiver`:
   - Pass normalized family QR data and normalized events to `send-welcome-email`.
   - This prevents provider-specific content gaps (so behavior is consistent whether provider is Resend or Microsoft Graph).

Phase 3 — Fix standalone resend utility path used from Email Logs
5. Update `supabase/functions/resend-welcome-email/index.ts`:
   - Reuse the same fallback strategy for event details:
     - `events_json` → `events_list` → assigned marketplace IDs.
   - Ensure family section includes all existing family QR cards, not only those matching dependent list length.

Phase 4 — Improve Manage Users manual onboarding path (prevents future recurrence)
6. Update manual create flow:
   - `src/components/admin/UserManagement.tsx`: add optional marketplace selection at creation time for volunteers.
   - `src/hooks/useSupabaseData.ts` (`useCreateUser`): send selected marketplace/event data to backend.
   - `supabase/functions/create-user/index.ts`:
     - persist normalized event context (at minimum usable `events_json` or equivalent structured event fields),
     - optionally assign created QR card to selected marketplace when provided.
7. Keep compatibility with existing users:
   - no destructive migration needed,
   - resend now reconstructs event info from existing assignments, so old records are fixed operationally without manual data repair.

Validation & QA plan (end-to-end first):
1) End-to-end test from admin UI:
   - Create volunteer in Manage Users with marketplace selected.
   - Resend welcome email.
   - Verify email contains marketplace date/time/location and QR block.
2) Family flow test:
   - Approve/register volunteer with dependents.
   - Verify initial thank-you email includes all family QR cards.
   - Resend from both Pending Volunteers and Email Logs viewer; verify family QR count/IDs remain complete.
3) Regression tests:
   - Volunteer with `events_json` present (webhook source) still renders correctly.
   - Volunteer with `events_json` missing but `marketplace_id` assigned now renders event details.
   - Volunteer with no event data still sends successfully (graceful fallback).
4) Spot-check logs:
   - confirm email_send_logs request payload includes event count/family count consistently,
   - verify no new send failures introduced.

Files to update:
- `supabase/functions/webhook-receiver/index.ts`
- `supabase/functions/send-welcome-email/index.ts`
- `supabase/functions/resend-welcome-email/index.ts`
- `supabase/functions/create-user/index.ts`
- `src/hooks/useSupabaseData.ts`
- `src/components/admin/UserManagement.tsx`

Risk controls:
- Keep all new fields optional to avoid breaking existing callers.
- Preserve current template content and only add missing sections/fallbacks.
- Avoid schema migrations unless absolutely necessary (current fix is code-level and backward-compatible).

Expected outcome:
- Family-member QR codes consistently appear in thank-you/resend emails.
- Marketplace/event details appear on resend even for manually created users.
- Manage Users flow no longer creates “marketplace-empty” welcome email scenarios.
