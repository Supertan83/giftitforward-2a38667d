

## Add Check-In and Check-Out Kiosk Accounts

### Overview

Create 6 new kiosk-style accounts that work identically to the existing tablet kiosk accounts (acc01-acc25) but are locked to specific zones:
- **Check-in kiosks**: in01@gif.com, in02@gif.com, in03@gif.com -- locked to the **entrance** zone
- **Check-out kiosks**: out01@gif.com, out02@gif.com, out03@gif.com -- locked to the **exit** zone

These accounts will share all kiosk behaviors: no sign-out button, no bottom nav, auto-detect today's marketplace by date and time, skip the check-in gate.

### Changes

**1. Update kiosk detection logic** (`src/components/VolunteerInterface.tsx`)

Expand the single `KIOSK_PATTERN` regex into three patterns to detect the account type and its locked zone:

```text
const KIOSK_MARKETPLACE_PATTERN = /^acc\d{2}@gif\.com$/;
const KIOSK_CHECKIN_PATTERN = /^in\d{2}@gif\.com$/;
const KIOSK_CHECKOUT_PATTERN = /^out\d{2}@gif\.com$/;
```

Derive a single `isKioskAccount` boolean (true if any pattern matches) and a `kioskZone` value:
- `acc*` accounts: zone = `'marketplace'`
- `in*` accounts: zone = `'entrance'`
- `out*` accounts: zone = `'exit'`

Replace all existing `isKioskAccount` references to use the new boolean. Replace the hardcoded `setActiveZone('marketplace')` in the useEffect with `setActiveZone(kioskZone)`.

The `renderZone()` function will use `kioskZone` instead of always rendering `MarketplaceZone` for kiosk accounts -- it will render `EntranceZone`, `MarketplaceZone`, or `ExitZone` based on the account type.

**2. Create the 6 auth accounts in the database**

Use the existing `create-user` edge function (or direct admin API) to create 6 accounts with password `12345678`:
- in01@gif.com, in02@gif.com, in03@gif.com
- out01@gif.com, out02@gif.com, out03@gif.com

Each will automatically receive the `volunteer` role via the existing `handle_new_user_role` trigger.

**3. Pre-assign check-in status in the database**

Just like the existing acc01-acc25 accounts have pre-assigned `checked_in` status, the new accounts need `pending_volunteers` records and `volunteer_qr_cards` with:
- `status = 'checked_in'`
- `assigned_zone = 'entrance'` (for in* accounts) or `assigned_zone = 'exit'` (for out* accounts)

This ensures they bypass the check-in gate if the non-kiosk code path is ever reached.

### Technical Details

**File: `src/components/VolunteerInterface.tsx`**

Key changes:
- Replace `KIOSK_PATTERN` with 3 regex constants
- Add `kioskZone` derived variable: `'entrance' | 'marketplace' | 'exit' | null`
- `isKioskAccount` = any of the 3 patterns match
- In `useEffect`: use `setActiveZone(kioskZone)` instead of hardcoded `'marketplace'`
- In `renderZone()`: use `kioskZone` to pick the correct zone component instead of always `MarketplaceZone`
- Header subtitle: show "Check-in Kiosk", "Marketplace Kiosk", or "Check-out Kiosk" based on `kioskZone`
- All other kiosk behaviors (hide sign-out, hide bottom nav, auto-detect marketplace, gear icon) remain the same

**Database**: Create 6 auth users + pending_volunteers + volunteer_qr_cards records via edge function calls after implementation.

### No new dependencies or database schema changes required.

