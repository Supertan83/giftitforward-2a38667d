

# Station Scan Limit Configuration & UI Enforcement

## Problem
Currently, the quantity selector in the Marketplace Zone uses `beneficiary_credit_limit` (15-25) as the maximum. There is no separate "max items per scan" setting per station/marketplace. Volunteers must manually decide how many items to distribute per scan, adding mental load. When the limit is 1 item per scan, the entire quantity selector is unnecessary visual noise.

## Solution

Add a new `max_items_per_scan` column to `marketplace_events` and make the UI automatically adapt based on this configuration.

### 1. Database Migration

Add column to `marketplace_events`:

```sql
ALTER TABLE marketplace_events
ADD COLUMN max_items_per_scan integer NOT NULL DEFAULT 1;
```

Default is 1 (safest -- single item mode). Admins can increase it per marketplace event.

### 2. Admin Configuration (MarketplaceManagement.tsx)

Add a "Max Items Per Scan" field to both the create and edit marketplace forms, alongside the existing "Beneficiary Credit Limit" field. Range: 1 to beneficiary_credit_limit (capped).

### 3. MarketplaceZone UI Adaptation

The quantity selector will read `max_items_per_scan` from the selected marketplace and adapt:

**When `max_items_per_scan = 1`:**
- Hide the entire quantity selector (no +/- buttons, no presets)
- Scan button simply says "Scan to Distribute Item"
- Zero decision overhead for volunteers

**When `max_items_per_scan > 1`:**
- Show the quantity selector, but cap at `max_items_per_scan` (not `creditLimit`)
- Display a clear label: **"Max X items per scan"** in a visible badge
- Quick-select presets filtered to values <= max_items_per_scan
- Plus button disabled at the station limit

### 4. Files Changed

| File | Change |
|------|--------|
| Database migration | Add `max_items_per_scan` column |
| `src/components/zones/MarketplaceZone.tsx` | Read `max_items_per_scan`, conditionally hide/show quantity selector, cap quantity, show "Max X" badge |
| `src/components/admin/MarketplaceManagement.tsx` | Add input field for `max_items_per_scan` in create + edit forms |
| `src/types/index.ts` | Add `max_items_per_scan` to `MarketplaceEvent` type |

### 5. UI Behavior Summary

```text
max_items_per_scan = 1 (default)
+----------------------------------+
|  [Scan to Distribute Item]       |  <- No quantity selector shown
+----------------------------------+

max_items_per_scan = 5
+----------------------------------+
|  Items to Distribute Per Scan    |
|  Max 5 items                     |
|  [-]  3  [+]                     |
|  (1) (3) (5)                     |  <- presets capped at 5
|  [Scan to Distribute 3 Items]    |
+----------------------------------+
```

### 6. Backend RPC Safety

The existing RPC functions (`distribute_marketplace_items_batch`) already enforce the beneficiary credit limit server-side. The station scan limit is a UI-level constraint to reduce volunteer error. The backend remains the final enforcer for credit limits.

