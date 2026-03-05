

# Add Live Queue Metrics to Admin Dashboard Home

## What
The admin dashboard home page (the default view when you land on the admin panel) currently only shows the "Distribution by Marketplace" table. It's missing the Live Queue metrics that were added to the Statistics page and Employee dashboard. We need to add the same real-time queue visibility here since this is the first thing admins see.

## Changes

### File: `src/components/admin/AdminDashboard.tsx`

1. **Import `useQRCards`** from `useSupabaseData` (already importing `useItemTypes` and `useMarketplaces` from there)
2. **Import icons**: `DoorOpen`, `LogOut`, `UserCheck`, `Activity` from lucide-react
3. **Add `useQRCards` hook** with `refetchInterval: 10000` for live updates
4. **Compute queue stats** in the `renderDashboardHome` function:
   - Activated today (cards with `activatedAt` matching today)
   - In Queue (cards with status `active`)
   - Checked Out (cards with status `checked_out`)
   - Total Served (active + checked_out)
5. **Render a "Live Queue" card** above the existing "Distribution by Marketplace" section, matching the same visual style already used in `StatisticsDashboard.tsx` (4 colored stat boxes in a grid with icons)

No new components needed — just adding the metrics card to the existing dashboard home view.

