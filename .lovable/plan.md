

## Update All Kiosk Accounts to Checked-In / Marketplace Zone

### Current State
All 25 kiosk accounts (acc01@gif.com - acc25@gif.com) exist in the database with volunteer QR cards, but:
- Card status: `inactive`
- Assigned zone: `none`
- Marketplace: `none`

### What Will Change

**Database update** -- Run a single SQL migration to update all 25 volunteer QR cards:
- Set `status` to `checked_in`
- Set `assigned_zone` to `marketplace`
- Set `checked_in_at` to the current timestamp

The marketplace will NOT be pre-assigned because kiosk accounts already have a manual marketplace selector in the UI -- the volunteer on the tablet picks which event they're at.

### Technical Details

**Migration SQL:**
```text
UPDATE volunteer_qr_cards
SET status = 'checked_in',
    assigned_zone = 'marketplace',
    checked_in_at = now(),
    updated_at = now()
WHERE volunteer_id IN (
  SELECT id FROM pending_volunteers
  WHERE email ~ '^acc\d{2}@gif\.com$'
);
```

This is a data-only change -- no code files are modified. The kiosk bypass logic in the app already handles the rest (skipping check-in gate, showing marketplace zone, hiding sign-out button).

