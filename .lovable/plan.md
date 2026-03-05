

# Add Real-Time Beneficiary Queue Visibility

## Problem
During live events, managers need to see activated, in-queue, checked-out, and total-served numbers at a glance. Currently these are buried or require checking multiple zones manually.

## What exists
`StatsDashboardZone.tsx` already computes `currentlyActive`, `checkedOut`, and `totalBeneficiaries` but presents them in a secondary "Card Status" section buried inside the Demographics card. The top stat cards show "Total Beneficiaries", "Activated Today", "Items Distributed", and "Avg Items/Person" — none of which directly answer the queue question.

`StatisticsDashboard.tsx` (admin) shows "Beneficiaries Served", "Items Distributed", "Active Cards", "Active Volunteers", "Total Children" — again no queue visibility.

## Plan

### 1. Reorganize StatsDashboardZone top cards
Replace the current 4 top stat cards with these 4 prominent metrics:
- **Activated (Entrance)** — total cards activated today (green, `DoorOpen` icon)
- **In Queue** — currently active cards, i.e. activated but not yet checked out (amber/warning, `Users` icon)  
- **Checked Out (Exit)** — cards that completed checkout (default, `LogOut` icon)
- **Total Served** — all processed cards: active + checked_out (primary, `UserCheck` icon)

Keep "Items Distributed" and "Avg Items/Person" as a secondary row below. Move the existing Active/Checked Out mini-bars out of the Demographics card since they're now top-level.

### 2. Add queue section to admin StatisticsDashboard
Add a new "Live Queue" card row at the top of the admin statistics page with the same 4 metrics (Activated, In Queue, Checked Out, Total Served), filtered by marketplace if one is selected. This gives admins the same consolidated view without needing to switch to the employee dashboard.

### 3. Enable real-time polling
The `useQRCards` hook already has a 30s stale time. Add `refetchInterval: 10000` (10 seconds) to both the StatsDashboardZone and StatisticsDashboard instances so numbers update automatically during live events without manual refresh.

## Files changed
1. **`src/components/zones/StatsDashboardZone.tsx`** — Reorganize top stat cards to prioritize queue metrics
2. **`src/components/admin/StatisticsDashboard.tsx`** — Add "Live Queue" summary row at top

