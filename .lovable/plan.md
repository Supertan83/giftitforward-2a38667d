

## Create 20 Test Volunteer Accounts for Dry Run

### Approach
Create a temporary edge function `create-test-volunteers` that uses the service role key to batch-create 20 test volunteer accounts (test01@gif.com through test20@gif.com) with password `12345678`, each linked to today's marketplace event.

### What the Edge Function Does
1. Creates 20 auth users (test01@gif.com - test20@gif.com) with password `12345678`
2. Assigns `volunteer` role to each
3. Creates `pending_volunteers` records (status: `approved`, source: `manual`)
4. Creates `volunteer_qr_cards` records (status: `inactive`) linked to today's marketplace (`d21fba59-2bf2-4a47-bd10-f88278d4c95e`)
5. Skips any that already exist
6. No emails sent -- these are just test accounts

### File Created
`supabase/functions/create-test-volunteers/index.ts`

- Uses service role key (no auth required, one-time use)
- Loops through test01-test20, creates each account
- Returns summary of created/skipped accounts

### After Deployment
- Call the function once to create all 20 accounts
- Volunteers can log in with `testXX@gif.com` / `12345678`
- They'll appear as regular volunteers assigned to today's dry run marketplace
- Can optionally delete the function after use

### Technical Details
- Marketplace ID: `d21fba59-2bf2-4a47-bd10-f88278d4c95e` (Dry Run Friday Marketplace - 27/02)
- QR codes generated with `VOL-` prefix pattern
- Each account gets a `pending_volunteers` record so the volunteer flow works end-to-end
