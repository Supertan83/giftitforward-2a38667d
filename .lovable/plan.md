

# Enhanced Scan Item Logs -- Volunteer Names, Bulk Grouping, Marketplace Sections

## Overview
Three improvements to the Beneficiary QR Control Center's scan logs:
1. **Show volunteer name** for each scan
2. **Collapse bulk scans** into a single row (e.g., "Distribution x3" instead of 3 rows)
3. **Group logs by marketplace** since QR cards are reusable across events

## What Changes

### Current Problem
- The `transactions` table has no `scanned_by` or `marketplace_id` columns, so we cannot tell which volunteer scanned or which marketplace event a transaction belongs to
- Bulk scans (e.g., 3 items at once) create 3 identical rows with the same timestamp instead of one row showing "x3"
- All transactions are shown in one flat list, even though the card may have been used across multiple marketplace events

### Solution

**Database changes:**
- Add `scanned_by` column (UUID) to `transactions` -- stores the auth user ID of the volunteer who performed the scan
- Add `marketplace_id` column (UUID) to `transactions` -- stores which marketplace the transaction occurred at
- Update all 5 distribution/return RPCs to record `auth.uid()` as `scanned_by` and `p_marketplace_id` as `marketplace_id`
- Update the `admin_adjust_card_balance` RPC to also record `auth.uid()` and the card's current marketplace

**Frontend changes in BeneficiaryQRControlCenter.tsx:**
- Fetch transactions with their `scanned_by` and `marketplace_id`
- Look up volunteer names by joining: `scanned_by` (auth user ID) -> `pending_volunteers.created_user_id` to get first/last name
- **Bulk grouping**: Group consecutive transactions with the same timestamp + type into a single row showing "Distribution x3 (+3)" instead of three "+1" rows
- **Marketplace sections**: Group transactions by marketplace_id, showing each marketplace as a collapsible section header (e.g., "Morning Marketplace -- Feb 28") with its transactions underneath

### Visual Layout After Changes

```text
+------------------------------------------+
| All Scan Item Logs (23 total)            |
+------------------------------------------+
| Morning Marketplace (Feb 28)       23 tx |
|   #  | Type            | Volunteer | Time     | Change |
|   23 | Distribution x6 | Ahmed A.  | 05:39:01 | +6     |
|   17 | Distribution x4 | Warda N.  | 05:21:46 | +4     |
|   ...                                    |
|    1 | CheckIn         | --        | 03:37:12 | 0      |
+------------------------------------------+
| Evening Marketplace (Feb 27)        5 tx |
|   ...previous event's transactions...    |
+------------------------------------------+
```

## Technical Details

### 1. Migration: Add columns to transactions table
```sql
ALTER TABLE transactions ADD COLUMN scanned_by uuid;
ALTER TABLE transactions ADD COLUMN marketplace_id uuid;
```
No foreign keys to auth.users (per guidelines). Nullable since historical data won't have these.

### 2. Update 5 existing RPCs
- `distribute_marketplace_item` -- add `scanned_by = auth.uid(), marketplace_id = p_marketplace_id` to INSERT
- `distribute_marketplace_items_batch` -- same
- `return_marketplace_item` -- same
- `return_marketplace_items_batch` -- same
- `admin_adjust_card_balance` -- add `scanned_by = auth.uid(), marketplace_id = v_card.marketplace_id`

### 3. Frontend: Enhanced transaction fetching
- Query transactions including the new `scanned_by` and `marketplace_id` columns
- Fetch all distinct marketplace names for the transactions' marketplace_ids
- Fetch volunteer names: query `pending_volunteers` where `created_user_id` matches any `scanned_by` UUID, building a lookup map of user_id to name
- **Bulk grouping logic**: Group rows by `(timestamp, type, scanned_by)` -- rows sharing all three values get merged into one row with `quantity` count and summed `credit_change`
- **Marketplace grouping**: Sort grouped transactions by marketplace_id, then timestamp desc. Render each marketplace as a separate accordion section

### Files Changed
1. **Migration**: Add `scanned_by` and `marketplace_id` columns to `transactions`
2. **Migration**: Update all 5 RPCs to populate the new columns
3. **Edit**: `src/components/admin/BeneficiaryQRControlCenter.tsx` -- enhanced log display with grouping and volunteer names

