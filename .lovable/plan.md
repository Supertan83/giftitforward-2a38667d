## Context

Three May 9, 2026 marketplaces currently exist for the same site (Al Khawaneej Street – Al Ttay – Dubai):

| # | Name | Time | external_id (Surpluss) | Has data? |
|---|------|------|------|------|
| 1 | Family Orphan Marketplace Morning Event | 09:00 – 02:00 | **48** | None (0 allocations, 0 cards, 0 transactions, 0 logs) |
| 2 | Low Income Families Marketplace Morning Event | 09:00 – 02:00 | NULL | None |
| 3 | Low Income Families Marketplace - Afternoon Event | 14:30 – 20:30 | NULL | None |

The user clarified that the renamed "Family Orphan" is the same real-world event as the Low Income one. The only valuable thing on Family Orphan today is its Surpluss linkage (`external_id = 48`), which must NOT be lost — otherwise the Surpluss sync, allocations, distribution reports, and future webhook traffic for that event will all break.

## Goal

- Keep the Surpluss linkage alive so all current and future Surpluss data flows into the Low Income marketplace.
- Remove the duplicate "Family Orphan" record cleanly.
- Lose zero data, current or future.

## Approach (chosen)

Rather than soft-delete the Family Orphan row (which would lose `external_id = 48` and force a relink), we will:

1. **Rename the Family Orphan row in place** to "Low Income Families Marketplace Morning Event". This preserves its `id` and `external_id = 48`, so all Surpluss syncs, allocation pushes, distribution reports, and webhook routing continue to work without any reconnect step.
2. **Soft-delete the empty duplicate** "Low Income Families Marketplace Morning Event" row (id `770c55ed-…`) since it has no allocations, no cards, no transactions, no manual counts, no surveys, and no Surpluss link. Soft delete keeps it recoverable per the project's universal `deleted_at` pattern.
3. **Leave the Afternoon event untouched** (id `c2b04114-…`). It is a separate time slot.

This avoids any data migration and any window where Surpluss event 48 is unlinked.

## Steps

1. `UPDATE marketplace_events SET name = 'Low Income Families Marketplace Morning Event', updated_at = now() WHERE id = '6de32a60-696d-4fbd-96bb-101201a89023';`
2. `UPDATE marketplace_events SET deleted_at = now() WHERE id = '770c55ed-4928-4037-ab89-628f02f4596e';`
3. Verify: confirm only two May 9 rows remain visible (Morning + Afternoon), Morning still has `external_id = 48`, and the Afternoon row is unaffected.

## Why this is safe

- Family Orphan has zero rows in: `marketplace_item_allocations`, `qr_cards`, `transactions`, `marketplace_manual_counts`, `pending_beneficiaries` (both `marketplace_id` and `marketplace_event_id`), `external_survey_responses`, `allocation_traceability_logs`, `archived_card_data`, and no demographics/manual_beneficiary_count populated.
- Renaming preserves the UUID PK, so any future references that already point at it stay valid.
- Preserving `external_id = 48` means the next Surpluss sync, batch_update, and distribution report for this event continue to land on the renamed marketplace automatically.
- The duplicate Low Income Morning row is soft-deleted (not hard-deleted), so it can be restored if anyone disagrees.

## Out of scope

- No code changes.
- No edge function changes.
- The Afternoon Low Income event (separate time slot) is not modified — and still needs Surpluss linkage to occur via a future Sync Marketplaces run when Surpluss publishes that event.
