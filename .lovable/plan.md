# Fix "QR Cards Activated" undercount on Feb 28 export

## Root cause (confirmed against the database)

For **She Thrives Women Workers Marketplace February 28** (`ff0d8005-7c85-4a8d-9e0c-147475e7b0eb`) the database holds:

- **864** distinct cards with scans tagged to this marketplace (only Distribution + Return).
- **1,191** distinct cards with scans on Feb 28 (Asia/Dubai) but `marketplace_id = NULL` — specifically 1,189 CheckIn, 413 Distribution and 1,175 CheckOut rows that were saved by the scanner without a marketplace tag.
- All 864 tagged cards are a strict subset of the 1,191 NULL-tagged cards.

The export reads `transactions` filtered by `marketplace_id = <event>`, so only the 864 tagged cards land in the workbook. The earlier "untagged scans on event day" fallback added to `fetchQrEvidence` is still in source but is clearly not active for this export (likely never re-published, and even when it does run it picks up scans from any concurrent event on the same date — fragile for audit work).

The check-in path (`activate_beneficiary_card` RPC called from EntranceZone) writes whatever `p_marketplace_id` it gets. When a kiosk session was opened without an event selected, every CheckIn/CheckOut on that device went in as NULL. That is why the auditor sees 864 instead of 1,183.

## Fix in three parts

### 1. Backfill historical NULL transactions (one-time data repair)

Add a migration that infers the correct `marketplace_id` for every existing NULL row and writes it back. Inference order, applied per card:

1. **Same-card tagged scan on the same Dubai day** → use that `marketplace_id`. Covers the 864 cards immediately.
2. **`archived_card_data.marketplace_id`** for that `original_card_id` whose `checked_out_at` falls on the same Dubai day → use it.
3. **`qr_cards.marketplace_id`** if the card is still linked and `activated_at` is the same Dubai day.
4. **Single marketplace scheduled for that Dubai day** (i.e. only one `marketplace_events.event_date` matches) → use it.
5. Anything left unresolved is logged to a small `transaction_backfill_unresolved` table for manual review (expected to be tiny — mostly test scans).

The migration runs inside a transaction, reports per-step counts, and is idempotent (only touches rows where `marketplace_id IS NULL`). Expected outcome for Feb 28: 1,191 distinct cards tagged to `ff0d8005…`, so the export immediately reads **1,183 activated / 1,189 checked in**.

### 2. Stop the bleeding at the scanner

- Update `activate_beneficiary_card`, `checkout_beneficiary_card`, `distribute_marketplace_item(s)_batch` and `return_marketplace_item(s)_batch` so that when the caller passes `NULL` they fall back to "the single marketplace scheduled today (Asia/Dubai)". If zero or more than one event is scheduled, raise an explicit error so the scanner shows a clear message instead of silently writing a NULL row.
- In `EntranceZone` and `BeneficiaryQRControlCenter`, disable the scan button until a marketplace is selected and surface the same guard in the UI (today the button is enabled even when `selectedMarketplaceId` is empty).

### 3. Make the export self-healing and label-clear

In `src/components/admin/MarketplaceReports.tsx → fetchQrEvidence`:

- Keep the existing tagged-scan fetch.
- Replace the "any NULL on event_date" fallback with a stricter one: pull NULL scans on the event day **and** only keep cards whose archived/active record points at this marketplace, or whose tagged scans elsewhere belong to this marketplace. This prevents accidental cross-event inflation once backfill is done.
- Add a small footnote row to the Summary sheet: `Reported Beneficiaries (manual count)` vs `Beneficiary QR Cards Scanned` vs `Cards Reconciled via Backfill` so the auditor can see the reconciliation explicitly.

## Verification

After the migration runs we will re-query and confirm:

- `SELECT COUNT(DISTINCT card_id) FROM transactions WHERE marketplace_id='ff0d8005…' AND type='CheckIn'` → **1,189**
- Re-export "QR Evidence" for She Thrives Feb 28 → Summary shows **Reported 1,183 / QR Activated 1,183 / Scanned 1,189**.
- Spot-check D022–D024 (other Feb events) to confirm their counts are unchanged or corrected upward.
- Sanity-check no card was tagged to two marketplaces.

## Files touched

- `supabase/migrations/<timestamp>_backfill_null_transaction_marketplace.sql` (new)
- `supabase/migrations/<timestamp>_harden_scan_rpcs.sql` (new — updates the four RPCs above)
- `src/components/zones/EntranceZone.tsx` (disable scan w/o marketplace)
- `src/components/admin/BeneficiaryQRControlCenter.tsx` (same guard)
- `src/components/admin/MarketplaceReports.tsx` (tighter fallback + summary labels)
