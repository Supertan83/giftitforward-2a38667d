

## Fix: Update Kiosk Pattern to Match `.com` Emails

### Problem
The kiosk accounts were created as `acc##@gif.com` but the detection regex in the code is `/^acc\d{2}@gif$/` (no `.com`), so the bypass never activates.

### Changes

**1. `src/components/VolunteerInterface.tsx`** (line 33)
Update the `KIOSK_PATTERN` constant:
```
// Before
const KIOSK_PATTERN = /^acc\d{2}@gif$/;

// After
const KIOSK_PATTERN = /^acc\d{2}@gif\.com$/;
```

**2. `supabase/functions/create-user/index.ts`** (line 8)
Update the email validation pattern to match:
```
// Before
const KIOSK_EMAIL_PATTERN = /^acc\d{2}@gif$/;

// After
const KIOSK_EMAIL_PATTERN = /^acc\d{2}@gif\.com$/;
```

**3. Create missing kiosk accounts**
Call the `create-user` edge function to provision any of the 25 accounts (`acc01@gif.com` through `acc25@gif.com`) that don't already exist, with password `12345678` and role `volunteer`.

### Summary
Two one-line regex fixes so the kiosk bypass logic recognizes the `.com` email format, plus account provisioning for any missing accounts.

