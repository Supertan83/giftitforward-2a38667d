
User reports yesterday's (4/18/2026) Taxi Drivers Afternoon marketplace shows 0 beneficiaries on the dashboard. Admin needs the correct number for calculations.

Likely cause: After the morning event, admin clicked "Archive & Reset Cards" which moved 844 checked_out cards to `archived_card_data` and reset `qr_cards`. Then the 82 active cards were transferred to Afternoon. After Afternoon ended, those cards were also likely archived/reset — so now `qr_cards` shows 0 for Afternoon, and the dashboard's "Total Served" falls back to `manual_beneficiary_count` (which is null) or `archived_card_data` count.

Need to investigate:
1. Count `archived_card_data` rows for Afternoon marketplace ID `a5a856a1-097b-42b0-a68f-a24c629f9e58`.
2. Count distinct cards in `transactions` for that marketplace (CheckIn type) — this is the true attendance.
3. Check current `manual_beneficiary_count` on the marketplace row.
4. Check current marketplace status (probably 'completed').

## Plan

1. Query DB to confirm:
   - Distinct beneficiary cards that checked in to Afternoon (from `transactions` where `marketplace_id = afternoon_id` and type = CheckIn).
   - Existing archived rows for Afternoon.
   - Current `manual_beneficiary_count` value.
2. Set `manual_beneficiary_count` on the Afternoon marketplace row to the verified attendance number, so dashboard falls back to it correctly (the StatsDashboardZone already reads `manual_beneficiary_count` when no live cards exist).
3. Confirm to admin: the number now displays on the dashboard and Marketplace Reports.

No code changes — pure data fix on `marketplace_events.manual_beneficiary_count`.
