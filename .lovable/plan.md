

# Add Per-Marketplace Breakdown to Admin Dashboard Live Queue

## Change

**File**: `src/components/admin/AdminDashboard.tsx`

1. **Update `queueStats`** to compute per-marketplace breakdowns in addition to the aggregate totals. Group `qrCards` by `marketplaceId`, and for each marketplace compute: activated today, in queue, checked out, total served. Resolve marketplace names from the existing `marketplaces` array.

2. **Add a per-marketplace breakdown UI** below the existing 4 aggregate metric boxes inside the Live Queue card. Render a compact table or list of rows — one per marketplace that has any activity — showing the same 4 columns (Activated, In Queue, Checked Out, Total Served) per marketplace name.

Cards without a `marketplaceId` will be grouped under "Unassigned" if any exist.

No new hooks, components, or database changes needed — all data is already available from the existing `useQRCards` and `useMarketplaces` hooks.

