

## Fix: Surpluss Volunteer/Beneficiary Sync Error

### Root Cause

The sync failed because:
1. **Staging URL is dead**: The Heroku staging app (`surpluss-server.herokuapp.com`) returns "No such app" (404 HTML page). This server has been shut down.
2. **No volunteers found**: There are 0 volunteer QR cards linked to that marketplace, so nothing was sent for volunteers.
3. **Demographics update failed**: The PUT request to the dead staging URL returned a 404.

### Proposed Changes

**1. Default to Production and remove Staging option**

Since the staging server no longer exists, update the environment selector in `MarketplaceReports.tsx` to:
- Default to `production` instead of `staging`
- Either remove the staging option entirely, or keep it but show a warning

**2. Better error messaging in the edge function**

Update `sync-surpluss-volunteer-beneficiary/index.ts` to:
- Detect HTML responses (non-JSON) and show a clearer error like "API endpoint unavailable" instead of raw HTML
- Include a summary in the response indicating which environment was used

### Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/MarketplaceReports.tsx` | Change default environment from `staging` to `production`, optionally remove staging option |
| `supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts` | Add HTML response detection for clearer error messages |

### Immediate Workaround

You can switch the environment dropdown from "Staging" to "Production" before clicking "Send to Surpluss" -- this will use the working `api.thesurpluss.com` URL.

