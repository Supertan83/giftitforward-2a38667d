## Add "Checked In At" column to Beneficiary QR Evidence sheet

In `src/components/admin/MarketplaceReports.tsx`, inside `buildQrSheets`:

1. Extend the per-card aggregate to capture the actual check-in timestamp from the transaction log (transaction type `CheckIn` / `check_in`, normalized by stripping underscores/spaces/dashes). Keep the earliest matching timestamp per card.
2. Add a new `'Checked In At'` field on each evidence row, placed right after `Status`, sourced in this priority:
   - First `CheckIn` transaction timestamp
   - Fallback: card `activated_at`
   - Fallback: first scan timestamp
3. Keep `First Scan At` and `Last Scan At` as-is (they remain useful for audit).
4. Re-sort evidence rows by `Checked In At` ascending so the sheet reads in arrival order.
5. Update the totals footer row and the `totalActivated` count to use `Checked In At` instead of `First Scan At`.

No DB or backend changes. Same data sources (`transactions`, `qr_cards`, `archived_card_data`).