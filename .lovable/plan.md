

# Add "Training Completed After Event" Card to Marketplace Reports

## What
Add a new stat card in the Marketplace Report's volunteer section showing how many volunteers completed the training module **after** the marketplace event date.

## How

### 1. Update `useMarketplaceAllocations.ts` — add training completion count to report data
- The `formRegisteredVolunteers` query already fetches volunteers matched to the marketplace. Expand the select to include `training_completed, training_completed_at`.
- After building the volunteer list, count how many of those volunteers have `training_completed = true` AND `training_completed_at > event_date`.
- Add `trainingCompletedAfterEvent: number` to the returned `volunteers` object.

### 2. Update `MarketplaceReports.tsx` — render the new card
- Add a new stat card in the volunteer summary grid (lines ~370-395) showing the count with a `GraduationCap` icon.
- Style it consistently with the existing cards (e.g., indigo/purple theme).

### Files to modify
- `src/hooks/useMarketplaceAllocations.ts` — expand query + compute count
- `src/components/admin/MarketplaceReports.tsx` — render new card

