

## Scanning Logic: Stop Auto-Deducting from Available Items

### Problem
When a volunteer scans a beneficiary's QR card in the Marketplace Zone, the system increments `distributed_quantity` on allocations and the UI displays **"Remaining = Allocated - Distributed"**, making it look like inventory is shrinking in real-time. You need both numbers displayed independently:

- **Total Allocated**: Fixed number set by admin (e.g., 18,000) -- never changes during scanning
- **Total Scanned/Distributed**: Increments with each scan -- tracking only

### What Changes

#### 1. Update the Marketplace Zone UI (`src/components/zones/MarketplaceZone.tsx`)

- Replace the current "Remaining" stat card with a **"Total Allocated"** stat showing the fixed allocation number
- Rename "Distributed" to **"Total Scanned"** to clarify it's a tracking counter
- Remove the logic that disables the scan button when `totalAvailable <= 0` (since we're no longer treating allocated as a stock ceiling)
- Remove the "No Items Available" check before scanning
- The large center display will show **Total Scanned** count instead of "Items Available for Distribution"

#### 2. Update the RPC functions (database)

Modify `distribute_marketplace_item`:
- Remove the check `IF v_card.credit_balance >= v_limit` that blocks scanning when limit is hit (keep the per-beneficiary credit limit, just remove the allocation exhaustion check)
- Keep incrementing `distributed_quantity` on allocations (for tracking/reporting purposes)
- Remove the condition that only finds allocations with remaining stock (`allocated_quantity > distributed_quantity`) -- just find any allocation for the marketplace and increment

Modify `return_marketplace_item`:
- Keep decrementing `distributed_quantity` on returns (for accurate tracking)
- No other changes needed

#### 3. Update the `increment_marketplace_allocation_distributed` RPC
- Remove the check `IF a.distributed_quantity >= a.allocated_quantity` that blocks incrementing past the allocation ceiling

#### 4. Update the optimistic UI updates in MarketplaceZone
- Adjust the optimistic cache updates to match the new display logic (increment scanned count without checking against allocation ceiling)

### What Does NOT Change
- The per-beneficiary credit limit (e.g., 15 items per card) remains enforced
- The `marketplace_item_allocations` table structure stays the same
- Admin allocation management stays the same
- Reports continue to show both allocated and distributed numbers
- The `item_types.distributed` global counter logic is untouched (only the marketplace-level display changes)

### Technical Details

```text
BEFORE (current):
+--------------------+-------------------+-------------------+
| Total Allocated    | Distributed       | Remaining         |
| 18,000             | 5,200             | 12,800            |
+--------------------+-------------------+-------------------+
Scan button disabled when Remaining = 0

AFTER (proposed):
+--------------------+-------------------+
| Total Allocated    | Total Scanned     |
| 18,000             | 5,200             |
+--------------------+-------------------+
Scan button always enabled (only per-beneficiary limit enforced)
```

**Files to modify:**
- `src/components/zones/MarketplaceZone.tsx` -- UI display changes
- Database RPC: `distribute_marketplace_item` -- remove allocation ceiling check
- Database RPC: `increment_marketplace_allocation_distributed` -- remove ceiling check

