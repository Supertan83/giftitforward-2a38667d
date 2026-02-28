

# Beneficiary QR Control Center -- Updated Plan

## Overview
Build the Beneficiary QR Control Center as previously planned, with an additional expandable "Scan Item Logs" section that shows the full history of every scan (distribution, return, adjustment) for the looked-up QR card, including timestamps.

## What It Does

1. **Scan/Enter QR Code**: Admin scans or types a beneficiary QR ID
2. **Card Status Display**: Shows unique ID, status, marketplace, credit balance vs limit, items collected
3. **Adjust Balance**: Admin can manually correct the items collected count with audit logging
4. **Expandable Scan Item Logs** (NEW): An accordion/collapsible section showing ALL transactions for the card -- type (Distribution/Return/CheckIn/CheckOut/Adjustment), timestamp, credit change -- ordered newest first. This gives full visibility into what happened and when.

Note: The current `transactions` table does not track which volunteer performed each scan. The logs will show transaction type, timestamp, and credit change. A future enhancement could add a `scanned_by` column to track the volunteer/user who performed each scan.

---

## Technical Details

### 1. Database Migration: Add "Adjustment" to transaction_type enum
```sql
ALTER TYPE transaction_type ADD VALUE 'Adjustment';
```

### 2. Database Migration: Create `admin_adjust_card_balance` RPC
A SECURITY DEFINER function that:
- Validates admin role
- Looks up the card
- Updates `credit_balance` and `total_items_collected`
- Inserts an Adjustment transaction for audit
- Returns previous and new balance

### 3. New Component: `BeneficiaryQRControlCenter.tsx`

Layout:
```text
+------------------------------------------+
| Beneficiary QR Control Center            |
+------------------------------------------+
| [Scan QR]   [____Enter QR ID____] [Go]  |
+------------------------------------------+
| Card: QR-MLS1ZOLO-X382                  |
| Status: Active    Marketplace: Morning   |
| Items Collected: 17 / 23                |
| Credits Remaining: 6                     |
+------------------------------------------+
| Adjust Items Collected                   |
| [___17___] / 23     [Save Adjustment]   |
+------------------------------------------+
| v  All Scan Item Logs (23 total)        |  <-- Expandable
|   #  | Type         | Time     | Change |
|   23 | Distribution | 05:39:01 | +1     |
|   22 | Distribution | 05:39:01 | +1     |
|   ...                                    |
|    1 | CheckIn      | 04:52:12 | 0      |
+------------------------------------------+
```

Features:
- Uses existing `QRScanner` component for camera scanning
- Manual ID input with search
- Queries `qr_cards` by `unique_id` (case-insensitive)
- Fetches associated `marketplace_events` for credit limit and marketplace name
- Fetches ALL `transactions` for the card (not just today), ordered by timestamp desc
- Expandable accordion section with a table showing every transaction row: index number, type, formatted timestamp, credit change (+1/-1/0)
- Adjustment input calls the `admin_adjust_card_balance` RPC
- Success toast with previous vs new balance

### 4. Admin Sidebar + Dashboard Integration
- Add `'beneficiary-qr-control'` to the `AdminView` type in `AdminSidebar.tsx` and `AdminDashboard.tsx`
- Add sidebar item under "Beneficiary Apps" with a `ScanLine` icon
- Add the component to the `renderContent` switch in `AdminDashboard.tsx`

### Files Changed
1. **New**: `src/components/admin/BeneficiaryQRControlCenter.tsx`
2. **Edit**: `src/components/admin/AdminDashboard.tsx` -- add import, view type, switch case
3. **Edit**: `src/components/admin/AdminSidebar.tsx` -- add sidebar menu item
4. **Migration**: Add `Adjustment` to `transaction_type` enum + create `admin_adjust_card_balance` RPC

