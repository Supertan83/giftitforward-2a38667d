

## Tablet Kiosk Accounts — "bypass 1"

### What This Does
Creates 25 shared tablet accounts (acc01@gif through acc25@gif) that skip the volunteer check-in gate and land directly on the **Marketplace scanning zone**. No sign-out button is shown, and the session persists until explicitly logged out.

---

### Step 1: Create the 25 Accounts in the Database

Use the **create-user** edge function (already exists) to provision 25 accounts:
- Emails: `acc01@gif` to `acc25@gif`
- Password: `12345678` for all
- Role: `volunteer` (auto-assigned by existing trigger)

These will be created via the existing admin user-creation flow or a small script calling the edge function.

---

### Step 2: Add Kiosk Bypass Logic to VolunteerInterface

**File: `src/components/VolunteerInterface.tsx`**

- Detect if the logged-in user's email matches the kiosk pattern (`/^acc\d{2}@gif$/`)
- If kiosk account:
  - **Skip the check-in gate entirely** -- do not query `useVolunteerCheckInStatus` or ignore its result
  - **Default to the Marketplace zone** with a marketplace selector (same dropdown that exists for active/upcoming marketplaces)
  - **Hide the Sign Out button** from the user dropdown menu
  - **Show all three zone tabs as accessible** (or lock to marketplace only -- marketplace-only is simpler)

The key change in the component:

```text
const isKioskAccount = user?.email?.match(/^acc\d{2}@gif$/);

if (isKioskAccount) {
  // Skip check-in requirement
  // Show marketplace selector + MarketplaceZone directly
  // Hide sign-out button
}
```

---

### Step 3: Marketplace Selection for Kiosk Accounts

Since kiosk accounts have no check-in (and therefore no pre-assigned marketplace), show a **marketplace selector dropdown** at the top of the interface. This dropdown lists active/upcoming marketplaces, same as the existing `availableMarketplaces` list. Once selected, the MarketplaceZone renders with that marketplace ID.

---

### Step 4: Persistent Session (Already Handled)

The Supabase client is already configured with `persistSession: true` and `autoRefreshToken: true` in `src/integrations/supabase/client.ts`. Combined with hiding the Sign Out button, the tablet stays logged in across browser restarts and shifts. No additional code needed here.

---

### Files Modified

| File | Change |
|------|--------|
| `src/components/VolunteerInterface.tsx` | Add kiosk detection, bypass check-in, hide sign-out, show marketplace selector, default to marketplace zone |

### Account Provisioning

The 25 accounts will be created using the existing `create-user` edge function, called in sequence. Each account gets the `volunteer` role automatically.

---

### Summary

- 25 kiosk accounts: `acc01@gif` -- `acc25@gif`, password `12345678`
- No check-in required -- straight to marketplace scanning
- No sign-out button visible
- Marketplace selector shown so the volunteer picks which event they are at
- Session persists automatically (already configured)

