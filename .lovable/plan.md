## What I found

The delete action is writing exclusion records, but the report can still show some deleted rows because of two gaps:

1. **Card-backed rows don’t carry `volunteerId` into the UI row**, so delete relies on refetching the card. If the card is already soft-deleted/reassigned or the fetch doesn’t return the expected relationship, the exclusion can be incomplete.
2. **Inactive rows can reuse an old QR card from another marketplace**, so the UI treats them as card-backed rows and deletes the wrong card path instead of excluding the volunteer from the currently selected marketplace.

The database confirms recent exclusions exist, but there are duplicate volunteer profiles and cross-marketplace cards, which makes the current row identity too fragile.

## Plan

1. **Make volunteer report rows carry stable identity**
   - Add `volunteerId` to every card-backed volunteer row in `useMarketplaceReport`.
   - Track whether a row’s `cardId` belongs to the selected marketplace or is only a fallback QR card from another marketplace.

2. **Fix delete target selection in Marketplace Reports**
   - For rows with a real card in the current marketplace: soft-delete the card/attendance and insert an exclusion using the row’s `volunteerId`.
   - For inactive/fallback/cardless rows: do not delete a reused QR card; insert the exclusion directly for the selected marketplace.

3. **Harden report filtering**
   - Exclude volunteers consistently from:
     - form-registered rows
     - card/attendance rows
     - fallback inactive QR rows
     - dependent/family rows
   - Filter fallback QR cards with `.is('deleted_at', null)` so deleted cards are never reused for display.

4. **Backfill current affected rows**
   - Add a migration to insert missing marketplace exclusions for volunteers whose cards were soft-deleted in that marketplace, so previous delete attempts are honored after refresh.

5. **Verify with data checks**
   - Query a few recently deleted examples and confirm they now have matching exclusions for the same marketplace.
   - Confirm the report hook logic no longer allows those volunteers to be rebuilt as “Inactive” rows after refresh.