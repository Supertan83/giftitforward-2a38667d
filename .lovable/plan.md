
## Problem
Exit Zone shows ~44 checked-out for today's She Thrives Morning marketplace, but the team has physically checked out ~60. Investigation found **20 beneficiary cards activated TODAY (after 4:37 AM) are still linked to yesterday's marketplace** (`Inclusive Community: Family and People of Determination - Afternoon Event`, ID `71792e7c-…`). Of those, 19 are already `checked_out` and 1 is still `active`. They are invisible to today's Exit Zone counter because it filters by `marketplace_id = today's marketplace`.

Root cause: yesterday's cleanup didn't fully reset the `marketplace_id` on every card, OR a scanning tablet still has yesterday's event selected, so new activations write the old `marketplace_id`.

## Plan

1. **Reattach today's stray cards to today's marketplace.** Update the 20 cards (activated_at >= today 00:00 AND marketplace_id = `71792e7c-…`) to set `marketplace_id = a2d85409-…` (She Thrives Morning). Their status (`checked_out` / `active`) and timestamps stay as-is. After this, today's Exit Zone counter will reflect ~80 checked-out (61 + 19) and the still-active count will rise by 1.

2. **Also reattach their transactions for today.** Update `transactions` rows where `card_id` is in that set AND `timestamp >= today 00:00` AND `marketplace_id = 71792e7c-…` to point to today's marketplace, so distribution reports also align.

3. **Verify** by re-running the status counters for both marketplaces and confirming yesterday's marketplace only contains pre-today (older) records.

4. **Recommend operationally**: ask the field team to confirm every tablet has "She Thrives: Women Workers Marketplace - Morning Event" selected as the active marketplace before scanning. (No code change needed for this step — purely a comms note.)

## Out of scope (will not touch)
- The 9 truly-yesterday cards (`updated_day = OLDER`) under `71792e7c-…` — those are correctly closed yesterday's records and must stay linked to yesterday's event for reporting.
- No schema changes; no code changes to Exit Zone logic. The counter is correct — the data was mis-attributed.

## Expected outcome
- She Thrives Morning: ~166 active, ~80 checked-out (matches physical count of 60+ and growing).
- Yesterday's Inclusive Family event: returns to its closed state with only legitimate yesterday records.
