

## Per-Station Scan Limit with Gear Icon

### What Changes

1. **Remove quick-select preset buttons** (1, 3, 5, 10) from the Marketplace Zone
2. **Keep the +/- stepper** but cap it at the station limit instead of the beneficiary credit limit
3. **Add a gear icon** in the Marketplace header that opens a small popover to set/adjust the station's max items per scan
4. **Store the limit in localStorage** per marketplace, so each tablet remembers its setting across refreshes
5. **UI behavior**:
   - If station limit = 1: the +/- buttons are disabled (grayed out), quantity locked at 1
   - If station limit > 1: show a "Max X items" badge, +/- enabled up to that cap
   - Default station limit: 1 (safest default)

### How It Works

**File: `src/components/zones/MarketplaceZone.tsx`**

Changes:
- Add `stationLimit` state initialized from `localStorage` (key: `station_limit_{marketplaceId}`)
- Default to 1 if no value is stored
- Replace `creditLimit` with `stationLimit` as the cap for the quantity stepper
- Remove the quick-select preset buttons section entirely
- Add a gear icon button next to the mode toggle or header area
- Gear icon opens a Popover with a simple number input or stepper (1-25 range) to set the station limit
- On change, persist to localStorage and update state immediately
- The backend credit-limit enforcement remains unchanged (server-side RPCs still block exceeding beneficiary limits)

### UI Layout

```text
+------------------------------------------+
|  Marketplace                             |
|  Today's Event: [name]          [gear]   |
+------------------------------------------+
|  [Total Allocated]  [Total Scanned]      |
+------------------------------------------+
|         Total Items Scanned              |
|              42                          |
+------------------------------------------+
|  [  Distribute  ] [  Return  ]           |
+------------------------------------------+
|  Items to Distribute Per Scan            |
|  Station Limit: 3 items                  |
|                                          |
|    [ - ]      2      [ + ]               |
|                                          |
|  (if limit=1, buttons grayed out,        |
|   quantity fixed at 1)                   |
+------------------------------------------+
|  [ Scan to Distribute 2 Items ]          |
+------------------------------------------+
```

### Gear Popover

```text
+------------------------+
| Station Limit          |
|                        |
|  [ - ]   3   [ + ]    |
|                        |
| Items per scan for     |
| this station           |
+------------------------+
```

### Technical Details

- **Storage key**: `station_limit_{marketplaceId}` in localStorage
- **Default**: 1 (safe, requires explicit setup per station)
- **Range**: 1 to beneficiary credit limit (e.g., 1-25)
- **Quantity stepper cap**: `Math.min(stationLimit, creditLimit)` -- station limit wins but never exceeds the event's credit limit
- **Backend safety**: The `distribute_marketplace_items_batch` RPC already enforces the beneficiary's total credit limit server-side, so even if someone sets a high station limit, the server rejects over-limit distributions
- **No database changes** -- this is purely a local UI configuration per physical tablet/station

### Files Modified

Only one file: `src/components/zones/MarketplaceZone.tsx`
