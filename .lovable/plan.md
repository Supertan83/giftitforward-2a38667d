
User concern: admin clicked "Archive & Reset Cards" for today's morning event (Taxi Drivers Morning) on 844 stuck "checked_out" cards. She's worried this will duplicate distribution numbers in reports.

Need to investigate what "Archive & Reset Cards" actually does and confirm whether it's safe.

## Investigation needed

1. Find the component handling Archive & Reset Cards (likely `src/components/admin/ActiveBeneficiaryCards.tsx` or similar — based on the screenshot showing "Sync & Reset Cards" page).
2. Check the underlying logic — does it:
   - Copy cards to `archived_card_data` (preserves history)?
   - Reset the `qr_cards` row (clear `total_items_collected`, `collected_items`, `marketplace_id`, status → inactive)?
   - Delete or modify any `transactions` rows?
3. Verify reports source — `transactions` table is the source of truth for distribution counts. As long as transactions remain untouched, archiving + resetting cards does NOT duplicate or affect numbers.

## Expected answer (based on memory `mem://system/qr-card-lifecycle-management`)

The QR card lifecycle is designed exactly for this: archived data goes to `archived_card_data` for history, the physical card row resets so it can be reused at the next event, and reports pull from `transactions` (which are immutable and tied to the original marketplace_id). So **no duplication**.

But I need to confirm by reading the actual reset code + checking that today's morning event distribution counts are still intact.

## Plan

1. Read `ActiveBeneficiaryCards.tsx` to see exact archive + reset logic.
2. Query DB:
   - Count transactions for Taxi Drivers Morning event today (distribution count) — should match what was reported before reset.
   - Count rows in `archived_card_data` created today for that marketplace.
   - Count `qr_cards` that were reset (status now 'inactive', no marketplace_id).
3. Confirm to admin with concrete before/after numbers that nothing was duplicated and reports are safe.

No code changes — pure investigation + reassurance with data.
