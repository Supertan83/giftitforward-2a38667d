

## Fix: Prevent QR Card Reuse on Same Day per Marketplace

### Problem
When a beneficiary's QR card is checked out at the exit, the card status resets to `inactive` -- the same status as a brand-new card. This means it can be scanned again at the entrance and reactivated, allowing the same person to collect items a second time on the same day.

### Root Cause
The `checkoutCard` function sets the card status back to `inactive` and clears all data, but does NOT record that the card was already used today. The `activateCard` function only checks `if (card.status === 'active')` to block re-entry -- it has no awareness of same-day prior usage.

### Solution
Use a dedicated `checked_out` status to prevent same-day reuse. Instead of resetting cards to `inactive` on checkout, set them to `checked_out`. The nightly auto-unblock job already resets cards back to `inactive` the next day.

### Changes Required

**1. Update `checkoutCard` in `src/hooks/useSupabaseData.ts`**
- Change checkout status from `inactive` to `checked_out`
- Keep `marketplace_id` on the card so the nightly reset can archive it properly

**2. Update `activateCard` in `src/hooks/useSupabaseData.ts`**
- Add a check: if `card.status === 'checked_out'`, throw an error like "This card has already been used today. It will be available again tomorrow."

**3. No database migration needed**
- The `checked_out` value already exists in the `card_status` enum (`inactive | active | checked_out`)
- The `archived_card_data` table and nightly `auto-unblock-cards` edge function already handle resetting `checked_out` cards

### Technical Details

```text
Current flow:
  Entrance (inactive -> active) -> Exit (active -> inactive)
  Re-entry possible: inactive -> active  [BUG]

Fixed flow:
  Entrance (inactive -> active) -> Exit (active -> checked_out)
  Re-entry blocked: checked_out -> ERROR
  Next day: auto-unblock resets checked_out -> inactive
```

### Files to Modify
- `src/hooks/useSupabaseData.ts` -- 2 small changes in `activateCard` and `checkoutCard` mutations
- `src/store/useAppStore.ts` -- Update local mock store checkout logic to match (status -> `checked_out` instead of `ready`)

