

## Bug: Credit Display Mismatch After Check-In

### Problem
When a beneficiary card is activated at the Entrance Zone, the "Last Activated" card shows `0/15` instead of `0/20` (the correct marketplace credit limit). The main scan prompt correctly shows "activate with 20 credits", proving the marketplace credit limit IS 20 -- but the card display below falls back to 15.

### Root Cause
After card activation, `invalidateQueries(['qr_cards'])` fires, causing a React re-render. During this transient state, `selectedMarketplace` can briefly become `undefined`, and the fallback `?? 15` kicks in for `creditLimit`. Since `CardStatusDisplay` reads `creditLimit` reactively (not a captured snapshot), it picks up the fallback value of 15.

### Fix (2 files)

**1. `src/components/zones/EntranceZone.tsx`**
- Store the credit limit alongside the last activated card in state, so the display uses the value captured at activation time rather than the live reactive value.
- Add a `lastCreditLimit` state variable (e.g., `useState<number>(15)`)
- When activation succeeds, save `creditLimit` into `lastCreditLimit`
- Pass `lastCreditLimit` to `CardStatusDisplay` instead of the reactive `creditLimit`

**2. `src/components/CardStatusDisplay.tsx`**
- No functional change needed -- it already accepts `creditLimit` as a prop. But we will remove the default value of `15` and make it required, so future callers are forced to pass the correct value explicitly.

### Technical Details

```text
Current flow (buggy):
  activateCard succeeds
    -> invalidateQueries(['qr_cards'])
    -> React re-render
    -> marketplaces data temporarily undefined
    -> creditLimit = undefined ?? 15
    -> CardStatusDisplay shows 0/15

Fixed flow:
  activateCard succeeds
    -> save creditLimit to lastCreditLimit state
    -> invalidateQueries(['qr_cards'])
    -> React re-render
    -> CardStatusDisplay uses lastCreditLimit (20)
    -> shows 0/20
```

### Changes Summary
- Add `lastCreditLimit` state in EntranceZone
- Capture `creditLimit` on activation success into `lastCreditLimit`
- Pass `lastCreditLimit` to `CardStatusDisplay`
- Make `creditLimit` a required prop on `CardStatusDisplay` (remove default `= 15`)

